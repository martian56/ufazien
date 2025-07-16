from django.contrib import admin
from .models import AverageSchema, SchemaField, UserSchemaGrades, FieldGrade, SavedSchema

@admin.register(AverageSchema)
class AverageSchemaAdmin(admin.ModelAdmin):
    list_display = ['name', 'creator', 'is_public', 'created_at']
    list_filter = ['is_public', 'created_at']
    search_fields = ['name', 'creator__username']

@admin.register(SchemaField)
class SchemaFieldAdmin(admin.ModelAdmin):
    list_display = ['name', 'schema', 'weight', 'order']
    list_filter = ['schema']

@admin.register(UserSchemaGrades)
class UserSchemaGradesAdmin(admin.ModelAdmin):
    list_display = ['user', 'schema', 'current_schema', 'created_at']
    list_filter = ['current_schema', 'created_at']

@admin.register(FieldGrade)
class FieldGradeAdmin(admin.ModelAdmin):
    list_display = ['field', 'user_schema', 'grade']
    list_filter = ['field__schema']

@admin.register(SavedSchema)
class SavedSchemaAdmin(admin.ModelAdmin):
    list_display = ['user', 'original_schema', 'saved_at']
    list_filter = ['saved_at']
    search_fields = ['user__username', 'original_schema__name']
