from django.shortcuts import render, get_object_or_404
from django.contrib.auth.models import User
from django.db.models import Q, Count
from django.core.cache import cache
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from django.utils import timezone
from datetime import timedelta
import logging
import random

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from . import livekit_service, privileges
from .models import (
    Lobby, LobbyMember, PlayerPosition,
    ChatMessage, SavedLobby
)
from .serializers import (
    LobbySerializer, LobbyCreateSerializer, LobbyListSerializer,
    PlayerPositionSerializer, ChatMessageSerializer, SavedLobbySerializer,
    JoinLobbySerializer, QuickJoinSerializer
)

logger = logging.getLogger(__name__)


#: How many candidates quick-join considers. It only has to pick one somebody
#: will be happy with, and reading the whole table to do that is the cost this
#: number exists to bound.
QUICK_JOIN_SAMPLE = 25


class LobbyPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 50


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def lobby_list_create(request):
    """List all active lobbies or create a new one"""
    
    if request.method == 'GET':
        # Get query parameters
        search = request.GET.get('search', '')
        lobby_type = request.GET.get('type', 'all')  # all, public, private
        sort_by = request.GET.get('sort', 'created_at')  # created_at, players, name
        
        # Annotated up front. `current_players_count` and `is_full` are
        # serialised for every lobby and `is_full` calls the first, so a page
        # of ten was twenty extra COUNTs; the property reads the annotation
        # when there is one.
        # `select_related('host')` because every row serialises its host, and
        # without it that is one user lookup per lobby — which is most of what
        # was left once the counts stopped being per-row.
        queryset = (
            Lobby.objects.with_player_count()
            .select_related('host')
            .filter(is_active=True)
        )
        
        # Apply filters
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) | Q(description__icontains=search)
            )
        
        if lobby_type == 'public':
            queryset = queryset.filter(is_private=False)
        elif lobby_type == 'private':
            queryset = queryset.filter(is_private=True)
        
        # Apply sorting
        if sort_by == 'players':
            # Already annotated above, so this is just an ordering now.
            queryset = queryset.order_by('-player_count')
        elif sort_by == 'name':
            queryset = queryset.order_by('name')
        else:
            queryset = queryset.order_by('-created_at')
        
        # Paginate results
        paginator = LobbyPagination()
        page = paginator.paginate_queryset(queryset, request)
        
        if page is not None:
            serializer = LobbyListSerializer(page, many=True, context={'request': request})
            return paginator.get_paginated_response(serializer.data)
        
        serializer = LobbyListSerializer(queryset, many=True, context={'request': request})
        return Response(serializer.data)
    
    elif request.method == 'POST':
        serializer = LobbyCreateSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            lobby = serializer.save()
            
            # Automatically join the creator to the lobby
            LobbyMember.objects.create(lobby=lobby, user=request.user)
            
            # Create initial player position
            PlayerPosition.objects.create(
                user=request.user,
                lobby=lobby,
                x=400.0,  # Center of map
                y=300.0
            )

            return Response(
                LobbySerializer(lobby).data, 
                status=status.HTTP_201_CREATED
            )
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def lobby_detail(request, lobby_id):
    """Get, update, or delete a specific lobby"""
    lobby = get_object_or_404(Lobby, id=lobby_id, is_active=True)
    
    if request.method == 'GET':
        serializer = LobbySerializer(lobby)
        return Response(serializer.data)
    
    elif request.method == 'PUT':
        denied = _require(lobby, request.user, privileges.MANAGE,
                          'Only the host, or somebody they have allowed, can change this lobby.')
        if denied:
            return denied
        
        serializer = LobbyCreateSerializer(lobby, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(LobbySerializer(lobby).data)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    elif request.method == 'DELETE':
        denied = _require(lobby, request.user, privileges.MANAGE,
                          'Only the host, or somebody they have allowed, can close this lobby.')
        if denied:
            return denied

        lobby.is_active = False
        lobby.save(update_fields=['is_active'])
        return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def join_lobby(request):
    """Join a lobby with optional password"""
    serializer = JoinLobbySerializer(data=request.data)
    
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    lobby_id = serializer.validated_data['lobby_id']
    password = serializer.validated_data.get('password', '')
    
    lobby = get_object_or_404(Lobby, id=lobby_id, is_active=True)
    
    # Check if user is already in the lobby — treat as idempotent success
    if LobbyMember.objects.filter(lobby=lobby, user=request.user).exists():
        # Return current lobby data instead of an error so clients can proceed idempotently
        return Response(
            LobbySerializer(lobby).data,
            status=status.HTTP_200_OK
        )
    
    # Check password for private lobbies
    if lobby.is_private and lobby.password and lobby.password != password:
        return Response(
            {'error': 'Incorrect password'}, 
            status=status.HTTP_401_UNAUTHORIZED
        )
    
    # Check if lobby is full
    if lobby.is_full:
        return Response(
            {'error': 'Lobby is full'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Join the lobby
    LobbyMember.objects.create(lobby=lobby, user=request.user)
    
    # Create player position
    PlayerPosition.objects.get_or_create(
        user=request.user,
        lobby=lobby,
        defaults={'x': 400.0, 'y': 300.0}
    )
    
    return Response(
        LobbySerializer(lobby).data, 
        status=status.HTTP_200_OK
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def leave_lobby(request, lobby_id):
    """Leave a specific lobby"""
    lobby = get_object_or_404(Lobby, id=lobby_id, is_active=True)

    try:
        member = LobbyMember.objects.get(lobby=lobby, user=request.user)
        member.delete()
        
        # Remove player position
        PlayerPosition.objects.filter(lobby=lobby, user=request.user).delete()
        
        # The host keeps the lobby. It used to be handed to whoever was left,
        # so the person who made it lost it by stepping out for a minute — and
        # got it back only if they happened to be the last one standing.
        #
        # What that handover was really solving is that somebody has to be able
        # to moderate a room the host is not in. That is what the granted
        # privileges are for: the host hands out the individual powers rather
        # than the whole role. See `game/privileges.py`.
        if not LobbyMember.objects.filter(lobby=lobby).exists():
            # Nobody left at all — whoever walked out last, which is no longer
            # always the host now that the lobby stays with them. Asked of the
            # membership rather than of who is leaving: gated on the host, a
            # lobby the host had already left stayed active and empty for ever
            # once the last of the others went.
            #
            # The line that did this was commented out to begin with, which is
            # the same state by a different route: listed, counted in the stats,
            # and joinable by people who then found nobody in it.
            lobby.is_active = False
            lobby.save(update_fields=['is_active'])
        
        return Response({'message': 'Left lobby successfully'})
    
    except LobbyMember.DoesNotExist:
        return Response(
            {'error': 'You are not in this lobby'}, 
            status=status.HTTP_400_BAD_REQUEST
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def quick_join(request):
    """Find and join a suitable lobby automatically"""
    serializer = QuickJoinSerializer(data=request.data)
    
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    lobby_type = serializer.validated_data.get('preferred_lobby_type', 'public')
    max_players = serializer.validated_data.get('max_players_preference')
    
    # Only the ones with room in them, decided in the database. This used to
    # pull every active lobby on the platform into Python and call `is_full`
    # on each — a COUNT per lobby, unpaginated and unbounded, on every press
    # of the quick-join button.
    queryset = Lobby.objects.only_joinable().select_related('host').filter(is_active=True)
    
    # Exclude lobbies user is already in
    user_lobbies = LobbyMember.objects.filter(user=request.user).values_list('lobby_id', flat=True)
    queryset = queryset.exclude(id__in=user_lobbies)
    
    # Apply preferences
    if lobby_type == 'public':
        queryset = queryset.filter(is_private=False)
    elif lobby_type == 'private':
        queryset = queryset.filter(is_private=True)
    
    if max_players:
        queryset = queryset.filter(max_players__lte=max_players)
    
    # A bounded sample rather than the whole table. Ordering by id keeps the
    # slice stable, and picking from a handful is as good as picking from all
    # of them for what this does.
    available_lobbies = list(queryset.order_by('-created_at')[:QUICK_JOIN_SAMPLE])

    if not available_lobbies:
        return Response(
            {'error': 'No suitable lobbies found'},
            status=status.HTTP_404_NOT_FOUND
        )

    lobby = random.choice(available_lobbies)
    
    # Join the lobby
    LobbyMember.objects.create(lobby=lobby, user=request.user)
    PlayerPosition.objects.get_or_create(
        user=request.user,
        lobby=lobby,
        defaults={'x': 400.0, 'y': 300.0}
    )
    
    return Response({'lobby': LobbySerializer(lobby).data})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_lobbies(request):
    """Get user's current lobbies"""
    user_memberships = LobbyMember.objects.filter(
        user=request.user,
        lobby__is_active=True,
    ).select_related('lobby', 'lobby__host')
    
    lobbies = [membership.lobby for membership in user_memberships]
    serializer = LobbyListSerializer(lobbies, many=True, context={'request': request})
    
    return Response(serializer.data)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def saved_lobbies(request):
    """Get or add saved lobbies"""
    
    if request.method == 'GET':
        saved = SavedLobby.objects.filter(user=request.user).select_related(
            'lobby', 'lobby__host'
        )
        serializer = SavedLobbySerializer(saved, many=True)
        return Response(serializer.data)
    
    elif request.method == 'POST':
        lobby_id = request.data.get('lobby_id')
        
        try:
            lobby = Lobby.objects.get(id=lobby_id, is_active=True)
        except Lobby.DoesNotExist:
            return Response(
                {'error': 'Lobby not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        saved_lobby, created = SavedLobby.objects.get_or_create(
            user=request.user, 
            lobby=lobby
        )
        
        if created:
            return Response(
                SavedLobbySerializer(saved_lobby).data, 
                status=status.HTTP_201_CREATED
            )
        else:
            return Response(
                {'message': 'Lobby already saved'}, 
                status=status.HTTP_200_OK
            )


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def remove_saved_lobby(request, lobby_id):
    """Remove a lobby from saved lobbies"""
    try:
        saved_lobby = SavedLobby.objects.get(user=request.user, lobby_id=lobby_id)
        saved_lobby.delete()
        return Response({'message': 'Lobby removed from saved'})
    except SavedLobby.DoesNotExist:
        return Response(
            {'error': 'Lobby not in saved list'}, 
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def lobby_stats(request):
    """Get lobby statistics"""
    stats = {
        'total_lobbies': Lobby.objects.filter(is_active=True).count(),
        'total_players': LobbyMember.objects.online().count(),
        'public_lobbies': Lobby.objects.filter(is_active=True, is_private=False).count(),
        'private_lobbies': Lobby.objects.filter(is_active=True, is_private=True).count(),
        'user_lobbies': LobbyMember.objects.filter(user=request.user, lobby__is_active=True).count(),
        'user_saved_lobbies': SavedLobby.objects.filter(user=request.user).count(),
    }
    
    return Response(stats)


# ---------------------------------------------------------------------------
# Realtime audio / screen share (LiveKit)
# ---------------------------------------------------------------------------

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def livekit_token(request, lobby_id):
    """Mint a LiveKit join token for the caller's membership of this lobby."""
    lobby = get_object_or_404(Lobby, id=lobby_id, is_active=True)

    try:
        member = LobbyMember.objects.get(lobby=lobby, user=request.user)
    except LobbyMember.DoesNotExist:
        return Response(
            {'error': 'Join the lobby before connecting to voice.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    try:
        payload = livekit_service.build_token(request.user, lobby, member)
    except livekit_service.LiveKitNotConfigured as exc:
        return Response(
            {'error': str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE
        )

    return Response(payload)


def _require(lobby, user, privilege, message='Only the lobby host can do that.'):
    """
    Gate one action on one privilege. Returns an error Response, or None.

    Host-only used to be the whole permission model, which is why leaving handed
    the lobby on: with the host gone there was nobody left who could do
    anything. The host keeps the lobby now and hands out powers instead, so
    every gate asks what somebody may do rather than who they are.
    """
    member = LobbyMember.objects.filter(lobby=lobby, user=user).first()
    if privileges.is_host(lobby, user) or privileges.member_may(lobby, member, privilege):
        return None
    return Response({'error': message}, status=status.HTTP_403_FORBIDDEN)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def set_member_muted(request, lobby_id, user_id):
    """Host mutes or unmutes a member."""
    lobby = get_object_or_404(Lobby, id=lobby_id, is_active=True)
    denied = _require(lobby, request.user, privileges.MUTE,
                      'Only the host, or somebody they have allowed, can mute people.')
    if denied:
        return denied

    member = get_object_or_404(LobbyMember, lobby=lobby, user_id=user_id)
    if member.user_id == lobby.host_id:
        return Response(
            {'error': 'The host cannot mute themselves.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    member.is_muted = bool(request.data.get('muted', True))
    member.save(update_fields=['is_muted'])
    livekit_service.sync_participant_permissions(lobby, member.user, member)

    return Response({
        'user_id': member.user_id,
        'is_muted': member.is_muted,
        'can_share_screen': member.can_share_screen,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def set_member_screen_share(request, lobby_id, user_id):
    """Host grants or revokes screen share for a member."""
    lobby = get_object_or_404(Lobby, id=lobby_id, is_active=True)
    denied = _require(lobby, request.user, privileges.MANAGE,
                      'Only the host, or somebody they have allowed, can hand out screen sharing.')
    if denied:
        return denied

    member = get_object_or_404(LobbyMember, lobby=lobby, user_id=user_id)
    member.can_share_screen = bool(request.data.get('allowed', True))
    member.save(update_fields=['can_share_screen'])
    livekit_service.sync_participant_permissions(lobby, member.user, member)

    return Response({
        'user_id': member.user_id,
        'is_muted': member.is_muted,
        'can_share_screen': member.can_share_screen,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def set_member_privileges(request, lobby_id, user_id):
    """
    Hand a member one of the host's powers, or take it back.

    Only the host does this. Granting is not itself grantable: somebody the
    host allowed to manage the lobby must not be able to promote themselves
    further, or to promote a friend and lock the host out of their own room.
    """
    lobby = get_object_or_404(Lobby, id=lobby_id, is_active=True)
    if not privileges.is_host(lobby, request.user):
        return Response(
            {'error': 'Only the host can change what somebody is allowed to do.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    member = get_object_or_404(LobbyMember, lobby=lobby, user_id=user_id)
    if member.user_id == lobby.host_id:
        return Response(
            {'error': 'The host already has every privilege.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    changed = []
    for name, _label in privileges.PRIVILEGES:
        if name not in request.data:
            continue
        field = privileges.PRIVILEGE_FIELDS[name]
        setattr(member, field, bool(request.data[name]))
        changed.append(field)

    if not changed:
        return Response(
            {'error': f'Name at least one of: {", ".join(n for n, _ in privileges.PRIVILEGES)}.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    member.save(update_fields=changed)

    # Screen sharing is minted into the LiveKit token, so a grant that is not
    # pushed does nothing until they reconnect. Best effort: voice is optional
    # here, and a machine without the credentials is the normal case in dev.
    if 'can_share_screen' in changed:
        try:
            livekit_service.sync_participant_permissions(lobby, member.user, member)
        except livekit_service.LiveKitNotConfigured:
            pass

    return Response({'user_id': member.user_id, **privileges.granted_to(lobby, member)})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def kick_member(request, lobby_id, user_id):
    """
    Remove somebody from the lobby.

    Their membership and their position go, which is what leaving does; the
    socket finds out because the group is told, and a client that ignores it
    still cannot rejoin without going through `join_lobby` again.
    """
    lobby = get_object_or_404(Lobby, id=lobby_id, is_active=True)
    denied = _require(lobby, request.user, privileges.KICK,
                      'Only the host, or somebody they have allowed, can remove people.')
    if denied:
        return denied

    if int(user_id) == lobby.host_id:
        return Response(
            {'error': 'The host cannot be removed from their own lobby.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if int(user_id) == request.user.id:
        return Response(
            {'error': 'Leave the lobby rather than removing yourself.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    member = get_object_or_404(LobbyMember, lobby=lobby, user_id=user_id)
    username = member.user.username
    removed_user = member.user
    member.delete()
    PlayerPosition.objects.filter(lobby=lobby, user_id=user_id).delete()

    # And off the call. LiveKit is a separate service that knows nothing about
    # the row we just deleted, so without this somebody turned out of a lobby
    # stayed on the voice channel — still heard, still watching a screen share.
    livekit_service.remove_participant(lobby, removed_user)

    _tell_the_lobby(lobby_id, {'type': 'member_removed', 'user_id': int(user_id)})

    return Response({'user_id': int(user_id), 'username': username, 'removed': True})


def _tell_the_lobby(lobby_id, message):
    """
    Push something to everyone on the lobby's socket, if there is a layer.

    Best effort by design: this is a REST handler, and a channel layer that is
    not configured — or a lobby nobody has a socket open on — must not turn
    into a 500 on an action that has already happened in the database.
    """
    try:
        layer = get_channel_layer()
        if layer is None:
            return
        async_to_sync(layer.group_send)(f'lobby_{lobby_id}', message)
    except Exception:
        logger.exception('Could not reach lobby %s over the channel layer', lobby_id)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def lobby_permissions(request, lobby_id):
    """Current A/V permissions for everyone in the lobby."""
    lobby = get_object_or_404(Lobby, id=lobby_id, is_active=True)
    if not LobbyMember.objects.filter(lobby=lobby, user=request.user).exists():
        return Response(
            {'error': 'Not a member of this lobby.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    members = LobbyMember.objects.filter(lobby=lobby).select_related('user')
    return Response({
        'host_id': lobby.host_id,
        'members': [
            {
                'user_id': m.user_id,
                'username': m.user.username,
                'full_name': m.user.get_full_name() or m.user.username,
                'is_muted': m.is_muted,
                'is_host': m.user_id == lobby.host_id,
                'is_online': m.is_online,
                # What they may do, host included — the host holds everything
                # implicitly, so this is the only place it is spelled out.
                **privileges.granted_to(lobby, m),
                # Kept for the clients that already read this name.
                'can_share_screen': privileges.member_may(lobby, m, privileges.PRESENT),
            }
            for m in members
        ],
    })
