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

from .models import (
    Lobby, LobbyMember, PlayerPosition, StudyRoom, 
    ChatMessage, SavedLobby
)
from .serializers import (
    LobbySerializer, LobbyCreateSerializer, LobbyListSerializer,
    PlayerPositionSerializer, ChatMessageSerializer, SavedLobbySerializer,
    JoinLobbySerializer, QuickJoinSerializer
)


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
        
        # Base queryset
        queryset = Lobby.objects.filter(is_active=True)
        
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
            # Sort by current player count (requires annotation)
            queryset = queryset.annotate(
                player_count=Count('members', filter=Q(members__is_online=True))
            ).order_by('-player_count')
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
            
            # Create default study rooms
            default_rooms = [
                {'name': 'Library', 'x': 100, 'y': 100, 'width': 200, 'height': 150},
                {'name': 'Study Room 1', 'x': 400, 'y': 100, 'width': 150, 'height': 100},
                {'name': 'Study Room 2', 'x': 400, 'y': 250, 'width': 150, 'height': 100},
                {'name': 'Computer Lab', 'x': 600, 'y': 100, 'width': 180, 'height': 120},
            ]
            
            for room_data in default_rooms:
                StudyRoom.objects.create(lobby=lobby, **room_data)
            
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
        
        # If host leaves, transfer host to another member or deactivate lobby
        if lobby.host == request.user:
            remaining_members = LobbyMember.objects.filter(lobby=lobby, is_online=True)
            if remaining_members.exists():
                lobby.host = remaining_members.first().user
                lobby.save()
            else:
                # lobby.is_active = False
                lobby.save()
        
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
    
    # Build query
    queryset = Lobby.objects.filter(is_active=True)
    
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
    
    # Find lobbies that aren't full
    available_lobbies = []
    for lobby in queryset:
        if not lobby.is_full:
            available_lobbies.append(lobby)
    
    if not available_lobbies:
        return Response(
            {'error': 'No suitable lobbies found'}, 
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Join a random available lobby
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
        lobby__is_active=True
    ).select_related('lobby')
    
    lobbies = [membership.lobby for membership in user_memberships]
    serializer = LobbyListSerializer(lobbies, many=True)
    
    return Response(serializer.data)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def saved_lobbies(request):
    """Get or add saved lobbies"""
    
    if request.method == 'GET':
        saved = SavedLobby.objects.filter(user=request.user).select_related('lobby')
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
