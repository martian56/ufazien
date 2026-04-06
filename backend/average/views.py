from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.db.models import Count, F
from .models import AverageSchema, SchemaField, UserSchemaGrades, FieldGrade, SavedSchema
from .serializers import (
    AverageSchemaSerializer, UserSchemaGradesSerializer, 
    CreateSchemaSerializer, FieldGradeSerializer, SavedSchemaSerializer
)

class SchemaPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100

class MySchemasList(generics.ListAPIView):
    """List user's own schemas and saved schemas"""
    serializer_class = AverageSchemaSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = SchemaPagination
    
    def get_queryset(self):
        # Get user's own created schemas
        created_schemas = AverageSchema.objects.filter(creator=self.request.user)
        
        # Get schemas saved by the user
        saved_schema_ids = SavedSchema.objects.filter(
            user=self.request.user
        ).values_list('original_schema_id', flat=True)
        saved_schemas = AverageSchema.objects.filter(id__in=saved_schema_ids)
        
        # Combine both querysets and prefetch related data for usage_count
        return (created_schemas | saved_schemas).distinct().order_by('-created_at').prefetch_related(
            'userschemagrades_set', 'saved_by_users', 'fields'
        )
    
    def get_serializer_context(self):
        return {'request': self.request}

class PublicSchemasList(generics.ListAPIView):
    """List all public schemas"""
    serializer_class = AverageSchemaSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = SchemaPagination
    
    def get_queryset(self):
        search = self.request.query_params.get('search', '')
        queryset = AverageSchema.objects.filter(is_public=True).annotate(
            # Count direct usage (UserSchemaGrades) - using lowercase model name for Count
            direct_usage_count=Count('userschemagrades', distinct=True),
            # Count saves (SavedSchema)
            saves_count=Count('saved_by_users', distinct=True),
            # Total usage count (sum of both)
            total_usage_count=F('direct_usage_count') + F('saves_count')
        ).prefetch_related(
            'userschemagrades_set', 'saved_by_users', 'fields'
        )
        if search:
            queryset = queryset.filter(name__icontains=search)
        # Order by total usage count (most used first), then by created_at for tie-breaking
        queryset = queryset.order_by('-total_usage_count', '-created_at')
        return queryset
    
    def get_serializer_context(self):
        return {'request': self.request}

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_schema(request):
    """Create a new average schema"""
    serializer = CreateSchemaSerializer(data=request.data)
    if serializer.is_valid():
        with transaction.atomic():
            # Create schema
            schema = AverageSchema.objects.create(
                name=serializer.validated_data['name'],
                description=serializer.validated_data.get('description', ''),
                creator=request.user
            )
            
            # Create fields
            for i, field_data in enumerate(serializer.validated_data['fields']):
                SchemaField.objects.create(
                    schema=schema,
                    name=field_data['name'],
                    weight=float(field_data['weight']),
                    order=i
                )
            
            # Create user schema grades entry
            user_schema = UserSchemaGrades.objects.create(
                user=request.user,
                schema=schema,
                current_schema=True
            )
            
            # Set all other schemas as not current
            UserSchemaGrades.objects.filter(
                user=request.user
            ).exclude(id=user_schema.id).update(current_schema=False)
            
            # Create empty field grades
            for field in schema.fields.all():
                FieldGrade.objects.create(
                    user_schema=user_schema,
                    field=field
                )
        
        return Response(AverageSchemaSerializer(schema).data, status=status.HTTP_201_CREATED)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def publish_schema(request, schema_id):
    """Publish a schema to make it public"""
    schema = get_object_or_404(AverageSchema, id=schema_id, creator=request.user)
    schema.is_public = True
    schema.save()
    return Response({'message': 'Schema published successfully'})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def use_schema(request, schema_id):
    """Start using a schema (make it current)"""
    schema = get_object_or_404(AverageSchema, id=schema_id)
    
    # Check if user already has this schema
    user_schema, created = UserSchemaGrades.objects.get_or_create(
        user=request.user,
        schema=schema
    )
    
    # Set as current schema
    UserSchemaGrades.objects.filter(
        user=request.user
    ).update(current_schema=False)
    
    user_schema.current_schema = True
    user_schema.save()
    
    # Create field grades if they don't exist
    for field in schema.fields.all():
        FieldGrade.objects.get_or_create(
            user_schema=user_schema,
            field=field
        )
    
    return Response(UserSchemaGradesSerializer(user_schema).data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def current_schema(request):
    """Get user's current schema with grades"""
    try:
        user_schema = UserSchemaGrades.objects.get(
            user=request.user,
            current_schema=True
        )
        return Response(UserSchemaGradesSerializer(user_schema).data)
    except UserSchemaGrades.DoesNotExist:
        return Response({'message': 'No current schema'}, status=status.HTTP_404_NOT_FOUND)

@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_grade(request, field_grade_id):
    """Update a grade for a specific field"""
    field_grade = get_object_or_404(
        FieldGrade, 
        id=field_grade_id, 
        user_schema__user=request.user
    )
    
    grade = request.data.get('grade')
    if grade is not None:
        try:
            grade = float(grade)
            if 0 <= grade <= 20:
                field_grade.grade = grade
                field_grade.save()
                return Response(FieldGradeSerializer(field_grade).data)
            else:
                return Response(
                    {'error': 'Grade must be between 0 and 20'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
        except ValueError:
            return Response(
                {'error': 'Invalid grade value'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
    else:
        field_grade.grade = None
        field_grade.save()
        return Response(FieldGradeSerializer(field_grade).data)

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_schema(request, schema_id):
    """Delete a schema (only by creator)"""
    schema = get_object_or_404(AverageSchema, id=schema_id, creator=request.user)
    schema.delete()
    return Response({'message': 'Schema deleted successfully'})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def save_schema(request, schema_id):
    """Save a public schema to user's saved schemas"""
    schema = get_object_or_404(AverageSchema, id=schema_id, is_public=True)
    
    # Check if user is trying to save their own schema
    if schema.creator == request.user:
        return Response(
            {'error': 'Cannot save your own schema'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Check if schema is already saved
    saved_schema, created = SavedSchema.objects.get_or_create(
        user=request.user,
        original_schema=schema
    )
    
    if created:
        return Response({'message': 'Schema saved successfully'})
    else:
        return Response(
            {'error': 'Schema already saved'}, 
            status=status.HTTP_400_BAD_REQUEST
        )

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def unsave_schema(request, schema_id):
    """Remove a schema from user's saved schemas"""
    saved_schema = get_object_or_404(
        SavedSchema, 
        user=request.user, 
        original_schema_id=schema_id
    )
    saved_schema.delete()
    return Response({'message': 'Schema removed from saved schemas'})
