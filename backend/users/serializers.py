from rest_framework import serializers
from django.contrib.auth import get_user_model

User = get_user_model()


class SignupSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ("first_name", "last_name", "email", "password")

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data["email"],
            email=validated_data["email"],
            first_name=validated_data["first_name"],
            last_name=validated_data["last_name"],
            password=validated_data["password"],
        )
        return user

class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField()

class PublicUserSerializer(serializers.ModelSerializer):
    """
    Serializer for public user information - excludes sensitive data like email, phone, GPA
    This should be used for displaying user info to other users (e.g., in blog posts, comments)
    """
    followers_count = serializers.IntegerField(source='followers.count', read_only=True)
    following_count = serializers.IntegerField(source='following.count', read_only=True)
    is_staff = serializers.BooleanField(read_only=True)
    is_active = serializers.BooleanField(read_only=True)
    avatar_url = serializers.SerializerMethodField()
    is_following = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "first_name",
            "last_name",
            "followers_count",
            "following_count",
            "is_following",
            "year",
            "bio",
            "avatar",
            "avatar_url",
            "major",
            "completed_credits",
            "is_staff",
            "is_active"
        ]

    def get_avatar_url(self, obj):
        request = self.context.get('request')
        if obj.avatar and hasattr(obj.avatar, 'url'):
            if request is not None:
                return request.build_absolute_uri(obj.avatar.url)
            return obj.avatar.url
        return None

    def get_is_following(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return request.user.following.filter(id=obj.id).exists()
        return False

class UserSerializer(serializers.ModelSerializer):
    followers_count = serializers.IntegerField(source='followers.count', read_only=True)
    following_count = serializers.IntegerField(source='following.count', read_only=True)
    is_staff = serializers.BooleanField(read_only=True)
    is_active = serializers.BooleanField(read_only=True)
    avatar_url = serializers.SerializerMethodField()
    is_following = serializers.SerializerMethodField()
    has_password = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "followers_count",
            "following_count",
            "is_following",
            "year",
            "bio",
            "avatar",
            "avatar_url",
            "major",
            "gpa",
            "completed_credits",
            "phone",
            "is_staff",
            "is_active",
            "has_password"
        ]
        extra_kwargs = {
            'password': {'write_only': True}
        }
    
    def get_has_password(self, obj):
        """Check if user has a usable password set by examining the password field directly"""
        from django.contrib.auth.hashers import UNUSABLE_PASSWORD_PREFIX
        if not obj.password:
            return False
        # Check if password is marked as unusable (starts with UNUSABLE_PASSWORD_PREFIX)
        if obj.password.startswith(UNUSABLE_PASSWORD_PREFIX):
            return False
        # If password exists and is not unusable, user has a password
        return True

    def to_representation(self, instance):
        """
        Override to_representation to hide sensitive fields from other users
        """
        data = super().to_representation(instance)
        request = self.context.get('request')
        
        # If no request context or user is not authenticated, hide sensitive info
        if not request or not request.user.is_authenticated:
            self._hide_sensitive_fields(data)
            return data
            
        # If the requesting user is not the profile owner, hide sensitive info
        if request.user.id != instance.id:
            self._hide_sensitive_fields(data)
        else:
            # Only show has_password to the user themselves
            # It's already included in the data, so we don't need to do anything
            pass
            
        return data
    
    def _hide_sensitive_fields(self, data):
        """
        Remove sensitive fields from the serialized data
        """
        sensitive_fields = ['email', 'phone', 'gpa', 'has_password']
        for field in sensitive_fields:
            if field in data:
                del data[field]

    def get_avatar_url(self, obj):
        request = self.context.get('request')
        if obj.avatar and hasattr(obj.avatar, 'url'):
            if request is not None:
                return request.build_absolute_uri(obj.avatar.url)
            return obj.avatar.url
        return None

    def get_is_following(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return request.user.following.filter(id=obj.id).exists()
        return False

    def validate_avatar(self, value):
        if value:
            print(f"Avatar validation - File: {value}, Size: {value.size}, Content Type: {getattr(value, 'content_type', 'Unknown')}")
            
            # Check file size (max 5MB)
            if value.size > 5 * 1024 * 1024:
                raise serializers.ValidationError("Avatar file size must be less than 5MB.")
            
            # Check file type
            allowed_types = ['image/jpeg', 'image/png', 'image/gif']
            if hasattr(value, 'content_type') and value.content_type not in allowed_types:
                raise serializers.ValidationError("Avatar must be a JPEG, PNG, or GIF image.")
        
        return value

    def update(self, instance, validated_data):
        print(f"UserSerializer update - validated_data: {validated_data}")
        
        # Handle avatar update
        if 'avatar' in validated_data:
            print(f"Updating avatar from {instance.avatar} to {validated_data['avatar']}")
            # Delete old avatar if it exists
            if instance.avatar:
                instance.avatar.delete(save=False)
        
        return super().update(instance, validated_data)