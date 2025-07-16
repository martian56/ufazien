from django.db import models

from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator
from django.contrib.auth import get_user_model

User = get_user_model()

class AverageSchema(models.Model):
    """Schema template for average calculations"""
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)
    creator = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='created_schemas')
    is_public = models.BooleanField(default=False)
    original_schema = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, help_text="Reference to original schema if this is a saved copy")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        unique_together = ['creator', 'name']  # User can't have duplicate schema names
    
    def __str__(self):
        return f"{self.name} by {self.creator.get_full_name()}"
    
    @property
    def usage_count(self):
        """Calculate how many times this schema has been used"""
        # Count direct usage (UserSchemaGrades)
        direct_usage = self.userschemagrades_set.count()
        
        # Count saves (SavedSchema)
        saves_count = self.saved_by_users.count()
        
        return direct_usage + saves_count

class SavedSchema(models.Model):
    """Track schemas saved by users from public schemas"""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='saved_schemas')
    original_schema = models.ForeignKey(AverageSchema, on_delete=models.CASCADE, related_name='saved_by_users')
    saved_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ['user', 'original_schema']  # User can only save a schema once
    
    def __str__(self):
        return f"{self.user.username} saved {self.original_schema.name}"

class SchemaField(models.Model):
    """Individual fields within a schema"""
    schema = models.ForeignKey(AverageSchema, on_delete=models.CASCADE, related_name='fields')
    name = models.CharField(max_length=100)
    weight = models.FloatField(validators=[MinValueValidator(0.0)])
    order = models.PositiveIntegerField(default=0)  # For field ordering
    
    class Meta:
        ordering = ['order', 'id']
    
    def __str__(self):
        return f"{self.name} (Weight: {self.weight})"

class UserSchemaGrades(models.Model):
    """User's grades for a specific schema"""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    schema = models.ForeignKey(AverageSchema, on_delete=models.CASCADE)
    current_schema = models.BooleanField(default=False)  # Track user's current active schema
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ['user', 'schema']
    
    def __str__(self):
        return f"{self.user.username} - {self.schema.name}"
    
    def calculate_weighted_average(self):
        """Calculate weighted average for this user's grades"""
        field_grades = self.field_grades.all()
        if not field_grades:
            return 0.0
        
        total_weighted_score = 0
        total_weight = 0
        
        for field_grade in field_grades:
            if field_grade.grade is not None:
                total_weighted_score += field_grade.grade * field_grade.field.weight
                total_weight += field_grade.field.weight
        
        return round(total_weighted_score / total_weight, 2) if total_weight > 0 else 0.0

class FieldGrade(models.Model):
    """Individual grade for a schema field"""
    user_schema = models.ForeignKey(UserSchemaGrades, on_delete=models.CASCADE, related_name='field_grades')
    field = models.ForeignKey(SchemaField, on_delete=models.CASCADE)
    grade = models.FloatField(
        null=True, 
        blank=True,
        validators=[MinValueValidator(0.0), MaxValueValidator(20.0)]
    )
    
    class Meta:
        unique_together = ['user_schema', 'field']
    
    def __str__(self):
        return f"{self.field.name}: {self.grade}"
