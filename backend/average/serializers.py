from rest_framework import serializers
from .models import AverageSchema, SchemaField, UserSchemaGrades, FieldGrade, SavedSchema
from django.contrib.auth.models import User

from api.sanitize import PlainTextFieldsMixin, plain_text

class SchemaFieldSerializer(PlainTextFieldsMixin, serializers.ModelSerializer):
    plain_text_fields = {"name": dict(max_length=100)}

    class Meta:
        model = SchemaField
        fields = ['id', 'name', 'weight', 'order']

class AverageSchemaSerializer(PlainTextFieldsMixin, serializers.ModelSerializer):
    plain_text_fields = {
        "name": dict(max_length=100),
        "description": dict(max_length=2000, keep_newlines=True),
    }
    fields = SchemaFieldSerializer(many=True, read_only=True)
    creator_full_name = serializers.CharField(source='creator.get_full_name', read_only=True)
    creator_username = serializers.CharField(source='creator.username', read_only=True)
    is_saved_by_user = serializers.SerializerMethodField()
    usage_count = serializers.ReadOnlyField()
    
    class Meta:
        model = AverageSchema
        fields = ['id', 'name', 'description', 'creator', 'creator_full_name', 'creator_username', 'is_public', 'is_saved_by_user', 'usage_count', 'created_at', 'updated_at', 'fields']
        read_only_fields = ['creator', 'created_at', 'updated_at']
    
    def get_is_saved_by_user(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return SavedSchema.objects.filter(user=request.user, original_schema=obj).exists()
        return False

class FieldGradeSerializer(serializers.ModelSerializer):
    field_name = serializers.CharField(source='field.name', read_only=True)
    field_weight = serializers.FloatField(source='field.weight', read_only=True)
    field_id = serializers.IntegerField(source='field.id', read_only=True)
    
    class Meta:
        model = FieldGrade
        fields = ['id', 'field', 'field_id', 'field_name', 'field_weight', 'grade']

class UserSchemaGradesSerializer(serializers.ModelSerializer):
    field_grades = FieldGradeSerializer(many=True, read_only=True)
    schema = AverageSchemaSerializer(read_only=True)
    weighted_average = serializers.SerializerMethodField()
    
    class Meta:
        model = UserSchemaGrades
        fields = ['id', 'schema', 'current_schema', 'field_grades', 'weighted_average', 'created_at', 'updated_at']
    
    def get_weighted_average(self, obj):
        return obj.calculate_weighted_average()

class CreateSchemaSerializer(PlainTextFieldsMixin, serializers.Serializer):
    name = serializers.CharField(max_length=100)
    description = serializers.CharField(allow_blank=True, required=False)
    fields = serializers.ListField(
        child=serializers.DictField(
            child=serializers.CharField()
        )
    )

    plain_text_fields = {
        "name": dict(max_length=100),
        "description": dict(max_length=2000, keep_newlines=True),
    }

    def validate_fields(self, value):
        if not value:
            raise serializers.ValidationError("At least one field is required")

        for field in value:
            if 'name' not in field or 'weight' not in field:
                raise serializers.ValidationError("Each field must have 'name' and 'weight'")

            try:
                weight = float(field['weight'])
                if weight <= 0:
                    raise serializers.ValidationError("Weight must be positive")
            except (ValueError, TypeError):
                raise serializers.ValidationError("Weight must be a valid number")

            field['name'] = plain_text(field['name'], max_length=100)

        return value

class SavedSchemaSerializer(serializers.ModelSerializer):
    schema = AverageSchemaSerializer(source='original_schema', read_only=True)
    
    class Meta:
        model = SavedSchema
        fields = ['id', 'schema', 'saved_at']
        read_only_fields = ['saved_at']