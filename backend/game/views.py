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
import random

from . import livekit_service
from .models import (
    Lobby, LobbyMember, PlayerPosition,
    ChatMessage, SavedLobby
)
from .serializers import (
    LobbySerializer, LobbyCreateSerializer, LobbyListSerializer,
    PlayerPositionSerializer, ChatMessageSerializer, SavedLobbySerializer,
    JoinLobbySerializer, QuickJoinSerializer
)


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
            serializer = LobbyListSerializer(page, many=True)
            return paginator.get_paginated_response(serializer.data)
        
        serializer = LobbyListSerializer(queryset, many=True)
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
        if lobby.host != request.user:
            return Response(
                {'error': 'Only the host can modify this lobby'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = LobbyCreateSerializer(lobby, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(LobbySerializer(lobby).data)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    elif request.method == 'DELETE':
        if lobby.host != request.user:
            return Response(
                {'error': 'Only the host can delete this lobby'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        lobby.is_active = False
        lobby.save()
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
        
        # If the host leaves, hand the lobby to somebody else or close it.
        if lobby.host == request.user:
            remaining_members = LobbyMember.objects.filter(lobby=lobby)
            if remaining_members.exists():
                lobby.host = remaining_members.first().user
                lobby.save(update_fields=['host'])

                # The new host's LiveKit grants are minted from `is_host` at
                # token time, so without this they cannot present until they
                # reconnect. Best effort: it is a no-op for somebody who is not
                # currently in the room.
                #
                # And it must not be able to stop somebody leaving. Voice is
                # optional — `CONTRIBUTING.md` says so, and a dev without the
                # credentials is the normal case — but
                # `sync_participant_permissions` deliberately re-raises
                # `LiveKitNotConfigured` so that the token endpoint can report
                # it. Uncaught here, walking out of a lobby returns a 500 on
                # every machine that has not set up LiveKit.
                new_member = remaining_members.first()
                try:
                    livekit_service.sync_participant_permissions(
                        lobby, new_member.user, new_member
                    )
                except livekit_service.LiveKitNotConfigured:
                    pass
            else:
                # Nobody left. The line that did this was commented out, so an
                # empty hostless lobby stayed active for ever — listed, counted
                # in the stats, and joinable by people who then found nobody in
                # it. The `lobby.save()` underneath it saved nothing at all.
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
    serializer = LobbyListSerializer(lobbies, many=True)
    
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
        'total_players': LobbyMember.objects.filter(is_online=True).count(),
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


def _require_host(lobby, user):
    """Only the lobby host moderates. Returns an error Response, or None."""
    if lobby.host_id != user.id:
        return Response(
            {'error': 'Only the lobby host can do that.'},
            status=status.HTTP_403_FORBIDDEN,
        )
    return None


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def set_member_muted(request, lobby_id, user_id):
    """Host mutes or unmutes a member."""
    lobby = get_object_or_404(Lobby, id=lobby_id, is_active=True)
    denied = _require_host(lobby, request.user)
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
    denied = _require_host(lobby, request.user)
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
                'can_share_screen': m.can_share_screen or m.user_id == lobby.host_id,
                'is_host': m.user_id == lobby.host_id,
            }
            for m in members
        ],
    })
