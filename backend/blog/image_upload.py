from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from django.core.exceptions import ValidationError
import uuid
import os
from PIL import Image
import io
from .security import SecurityUtils, rate_limiter

@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def upload_image(request):
    """
    Upload and optimize images for blog posts with security checks
    """
    # Rate limiting check
    user_id = str(request.user.id)
    if not rate_limiter.is_allowed(f"image_upload_{user_id}", max_requests=10, window_seconds=300):  # 10 uploads per 5 minutes
        return Response({'error': 'Upload rate limit exceeded. Please wait before uploading again.'}, 
                       status=status.HTTP_429_TOO_MANY_REQUESTS)
    
    if 'image' not in request.FILES:
        return Response({'error': 'No image file provided'}, status=status.HTTP_400_BAD_REQUEST)
    
    image_file = request.FILES['image']
    
    try:
        # Use security utils to validate the file
        SecurityUtils.validate_file_upload(image_file)
    except ValidationError as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        # Generate unique filename
        file_extension = os.path.splitext(image_file.name)[1]
        filename = f"{uuid.uuid4()}{file_extension}"
        
        # Optimize image if it's not GIF (to preserve animation)
        if image_file.content_type != 'image/gif':
            # Open and optimize the image
            img = Image.open(image_file)
            
            # Convert to RGB if necessary
            if img.mode in ('RGBA', 'LA', 'P'):
                background = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'P':
                    img = img.convert('RGBA')
                background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                img = background
            
            # Resize if too large (max 1920px width)
            if img.width > 1920:
                ratio = 1920 / img.width
                new_height = int(img.height * ratio)
                img = img.resize((1920, new_height), Image.Resampling.LANCZOS)
            
            # Save optimized image
            output = io.BytesIO()
            img.save(output, format='JPEG', quality=85, optimize=True)
            output.seek(0)
            
            # Save to storage
            filepath = f"blog/images/{filename}"
            saved_path = default_storage.save(filepath, ContentFile(output.read()))
        else:
            # Save GIF without optimization
            filepath = f"blog/images/{filename}"
            saved_path = default_storage.save(filepath, image_file)
        
        # Return the URL
        image_url = default_storage.url(saved_path)
        full_url = request.build_absolute_uri(image_url)
        
        return Response({
            'url': full_url,
            'filename': filename,
            'size': image_file.size
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        return Response({'error': f'Failed to process image: {str(e)}'}, 
                       status=status.HTTP_500_INTERNAL_SERVER_ERROR)
