from django.test import TestCase
from django.core.exceptions import ValidationError
from django.contrib.auth import get_user_model
from django.db import IntegrityError
from decimal import Decimal

from .models import AverageSchema, SavedSchema, SchemaField, UserSchemaGrades, FieldGrade

User = get_user_model()

class AverageSchemaModelTest(TestCase):
    """Test cases for AverageSchema model"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.schema_data = {
            'name': 'Math Average',
            'description': 'Mathematics semester average calculation',
            'creator': self.user,
            'is_public': False
        }
    
    def test_schema_creation(self):
        """Test schema is created correctly"""
        schema = AverageSchema.objects.create(**self.schema_data)
        
        self.assertEqual(schema.name, 'Math Average')
        self.assertEqual(schema.description, 'Mathematics semester average calculation')
        self.assertEqual(schema.creator, self.user)
        self.assertFalse(schema.is_public)
        self.assertIsNone(schema.original_schema)
        self.assertEqual(str(schema), f"Math Average by {self.user.get_full_name()}")
    
    def test_schema_unique_name_per_user(self):
        """Test schema name is unique per user"""
        AverageSchema.objects.create(**self.schema_data)
        
        # Try to create another schema with same name for same user
        with self.assertRaises(IntegrityError):
            AverageSchema.objects.create(**self.schema_data)
    
    def test_schema_same_name_different_users(self):
        """Test same schema name allowed for different users"""
        user2 = User.objects.create_user(
            username='user2',
            email='user2@example.com',
            password='testpass123'
        )
        
        AverageSchema.objects.create(**self.schema_data)
        
        # Should be able to create schema with same name for different user
        schema_data_2 = self.schema_data.copy()
        schema_data_2['creator'] = user2
        schema2 = AverageSchema.objects.create(**schema_data_2)
        
        self.assertEqual(schema2.name, 'Math Average')
        self.assertEqual(schema2.creator, user2)
    
    def test_schema_with_original_reference(self):
        """Test schema with original schema reference"""
        original_schema = AverageSchema.objects.create(**self.schema_data)
        
        copy_data = {
            'name': 'Math Average Copy',
            'creator': self.user,
            'original_schema': original_schema
        }
        copy_schema = AverageSchema.objects.create(**copy_data)
        
        self.assertEqual(copy_schema.original_schema, original_schema)
    
    def test_usage_count_property(self):
        """Test usage count calculation"""
        schema = AverageSchema.objects.create(**self.schema_data)
        
        # Initially should be 0
        self.assertEqual(schema.usage_count, 0)
        
        # Create user schema grades (direct usage)
        UserSchemaGrades.objects.create(user=self.user, schema=schema)
        self.assertEqual(schema.usage_count, 1)
        
        # Create saved schema
        user2 = User.objects.create_user(username='user2', email='user2@test.com', password='test')
        SavedSchema.objects.create(user=user2, original_schema=schema)
        self.assertEqual(schema.usage_count, 2)

class SavedSchemaModelTest(TestCase):
    """Test cases for SavedSchema model"""
    
    def setUp(self):
        self.user1 = User.objects.create_user(
            username='user1',
            email='user1@example.com',
            password='testpass123'
        )
        self.user2 = User.objects.create_user(
            username='user2',
            email='user2@example.com',
            password='testpass123'
        )
        self.schema = AverageSchema.objects.create(
            name='Public Math Schema',
            creator=self.user1,
            is_public=True
        )
    
    def test_saved_schema_creation(self):
        """Test saved schema is created correctly"""
        saved = SavedSchema.objects.create(
            user=self.user2,
            original_schema=self.schema
        )
        
        self.assertEqual(saved.user, self.user2)
        self.assertEqual(saved.original_schema, self.schema)
        self.assertEqual(str(saved), f"user2 saved Public Math Schema")
    
    def test_saved_schema_unique_constraint(self):
        """Test user can only save a schema once"""
        SavedSchema.objects.create(
            user=self.user2,
            original_schema=self.schema
        )
        
        # Try to save same schema again
        with self.assertRaises(IntegrityError):
            SavedSchema.objects.create(
                user=self.user2,
                original_schema=self.schema
            )

class SchemaFieldModelTest(TestCase):
    """Test cases for SchemaField model"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.schema = AverageSchema.objects.create(
            name='Test Schema',
            creator=self.user
        )
        self.field_data = {
            'schema': self.schema,
            'name': 'Midterm Exam',
            'weight': 0.4,
            'order': 1
        }
    
    def test_schema_field_creation(self):
        """Test schema field is created correctly"""
        field = SchemaField.objects.create(**self.field_data)
        
        self.assertEqual(field.schema, self.schema)
        self.assertEqual(field.name, 'Midterm Exam')
        self.assertEqual(field.weight, 0.4)
        self.assertEqual(field.order, 1)
        self.assertEqual(str(field), 'Midterm Exam (Weight: 0.4)')
    
    def test_schema_field_weight_validation(self):
        """Test schema field weight validation"""
        field_data = self.field_data.copy()
        field_data['weight'] = -0.1  # Negative weight
        
        field = SchemaField(**field_data)
        with self.assertRaises(ValidationError):
            field.full_clean()
    
    def test_schema_field_ordering(self):
        """Test schema fields are ordered correctly"""
        field2 = SchemaField.objects.create(
            schema=self.schema,
            name='Final Exam',
            weight=0.6,
            order=2
        )
        field1 = SchemaField.objects.create(
            schema=self.schema,
            name='Midterm Exam',
            weight=0.4,
            order=1
        )
        
        fields = SchemaField.objects.filter(schema=self.schema)
        self.assertEqual(list(fields), [field1, field2])
    
    def test_schema_field_cascade_delete(self):
        """Test field is deleted when schema is deleted"""
        field = SchemaField.objects.create(**self.field_data)
        self.assertEqual(SchemaField.objects.count(), 1)
        
        self.schema.delete()
        self.assertEqual(SchemaField.objects.count(), 0)

class UserSchemaGradesModelTest(TestCase):
    """Test cases for UserSchemaGrades model"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.schema = AverageSchema.objects.create(
            name='Test Schema',
            creator=self.user
        )
        self.field1 = SchemaField.objects.create(
            schema=self.schema,
            name='Midterm',
            weight=0.4
        )
        self.field2 = SchemaField.objects.create(
            schema=self.schema,
            name='Final',
            weight=0.6
        )
    
    def test_user_schema_grades_creation(self):
        """Test UserSchemaGrades is created correctly"""
        user_schema = UserSchemaGrades.objects.create(
            user=self.user,
            schema=self.schema,
            current_schema=True
        )
        
        self.assertEqual(user_schema.user, self.user)
        self.assertEqual(user_schema.schema, self.schema)
        self.assertTrue(user_schema.current_schema)
        self.assertEqual(str(user_schema), 'testuser - Test Schema')
    
    def test_user_schema_unique_constraint(self):
        """Test user-schema combination is unique"""
        UserSchemaGrades.objects.create(
            user=self.user,
            schema=self.schema
        )
        
        # Try to create another record for same user-schema
        with self.assertRaises(IntegrityError):
            UserSchemaGrades.objects.create(
                user=self.user,
                schema=self.schema
            )
    
    def test_calculate_weighted_average_empty(self):
        """Test weighted average calculation with no grades"""
        user_schema = UserSchemaGrades.objects.create(
            user=self.user,
            schema=self.schema
        )
        
        average = user_schema.calculate_weighted_average()
        self.assertEqual(average, 0.0)
    
    def test_calculate_weighted_average_with_grades(self):
        """Test weighted average calculation with grades"""
        user_schema = UserSchemaGrades.objects.create(
            user=self.user,
            schema=self.schema
        )
        
        # Create field grades
        FieldGrade.objects.create(
            user_schema=user_schema,
            field=self.field1,
            grade=15.0  # Midterm: 15/20, weight: 0.4
        )
        FieldGrade.objects.create(
            user_schema=user_schema,
            field=self.field2,
            grade=18.0  # Final: 18/20, weight: 0.6
        )
        
        # Expected: (15 * 0.4 + 18 * 0.6) / (0.4 + 0.6) = 16.8
        average = user_schema.calculate_weighted_average()
        self.assertEqual(average, 16.8)
    
    def test_calculate_weighted_average_partial_grades(self):
        """Test weighted average calculation with some missing grades"""
        user_schema = UserSchemaGrades.objects.create(
            user=self.user,
            schema=self.schema
        )
        
        # Only create grade for one field
        FieldGrade.objects.create(
            user_schema=user_schema,
            field=self.field1,
            grade=15.0  # Midterm: 15/20, weight: 0.4
        )
        # No grade for field2
        FieldGrade.objects.create(
            user_schema=user_schema,
            field=self.field2,
            grade=None
        )
        
        # Should only consider field1: (15 * 0.4) / 0.4 = 15.0
        average = user_schema.calculate_weighted_average()
        self.assertEqual(average, 15.0)

class FieldGradeModelTest(TestCase):
    """Test cases for FieldGrade model"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.schema = AverageSchema.objects.create(
            name='Test Schema',
            creator=self.user
        )
        self.field = SchemaField.objects.create(
            schema=self.schema,
            name='Test Field',
            weight=1.0
        )
        self.user_schema = UserSchemaGrades.objects.create(
            user=self.user,
            schema=self.schema
        )
    
    def test_field_grade_creation(self):
        """Test FieldGrade is created correctly"""
        field_grade = FieldGrade.objects.create(
            user_schema=self.user_schema,
            field=self.field,
            grade=15.5
        )
        
        self.assertEqual(field_grade.user_schema, self.user_schema)
        self.assertEqual(field_grade.field, self.field)
        self.assertEqual(field_grade.grade, 15.5)
        self.assertEqual(str(field_grade), 'Test Field: 15.5')
    
    def test_field_grade_null_grade(self):
        """Test FieldGrade with null grade"""
        field_grade = FieldGrade.objects.create(
            user_schema=self.user_schema,
            field=self.field,
            grade=None
        )
        
        self.assertIsNone(field_grade.grade)
        self.assertEqual(str(field_grade), 'Test Field: None')
    
    def test_field_grade_unique_constraint(self):
        """Test user_schema-field combination is unique"""
        FieldGrade.objects.create(
            user_schema=self.user_schema,
            field=self.field,
            grade=15.0
        )
        
        # Try to create another grade for same user_schema-field
        with self.assertRaises(IntegrityError):
            FieldGrade.objects.create(
                user_schema=self.user_schema,
                field=self.field,
                grade=18.0
            )
    
    def test_field_grade_validation(self):
        """Test FieldGrade validation"""
        # Test minimum grade
        field_grade = FieldGrade(
            user_schema=self.user_schema,
            field=self.field,
            grade=-1.0  # Below minimum
        )
        with self.assertRaises(ValidationError):
            field_grade.full_clean()
        
        # Test maximum grade
        field_grade.grade = 25.0  # Above maximum
        with self.assertRaises(ValidationError):
            field_grade.full_clean()
        
        # Test valid grade
        field_grade.grade = 15.0  # Valid grade
        field_grade.full_clean()  # Should not raise

class AverageCalculationIntegrationTest(TestCase):
    """Integration tests for average calculation system"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        
        # Create a realistic schema
        self.schema = AverageSchema.objects.create(
            name='Semester Average',
            description='Calculate semester average',
            creator=self.user,
            is_public=True
        )
        
        # Create fields with realistic weights
        self.participation = SchemaField.objects.create(
            schema=self.schema,
            name='Participation',
            weight=0.1,
            order=1
        )
        self.homework = SchemaField.objects.create(
            schema=self.schema,
            name='Homework',
            weight=0.2,
            order=2
        )
        self.midterm = SchemaField.objects.create(
            schema=self.schema,
            name='Midterm',
            weight=0.3,
            order=3
        )
        self.final = SchemaField.objects.create(
            schema=self.schema,
            name='Final Exam',
            weight=0.4,
            order=4
        )
    
    def test_complete_average_calculation(self):
        """Test complete average calculation workflow"""
        # User starts using the schema
        user_schema = UserSchemaGrades.objects.create(
            user=self.user,
            schema=self.schema,
            current_schema=True
        )
        
        # Add grades for each field
        grades_data = [
            (self.participation, 18.0),  # 18/20
            (self.homework, 16.0),       # 16/20
            (self.midterm, 14.0),        # 14/20
            (self.final, 15.0)           # 15/20
        ]
        
        for field, grade in grades_data:
            FieldGrade.objects.create(
                user_schema=user_schema,
                field=field,
                grade=grade
            )
        
        # Calculate expected average
        # (18*0.1 + 16*0.2 + 14*0.3 + 15*0.4) / (0.1+0.2+0.3+0.4)
        # = (1.8 + 3.2 + 4.2 + 6.0) / 1.0 = 15.2
        expected_average = 15.2
        
        calculated_average = user_schema.calculate_weighted_average()
        self.assertEqual(calculated_average, expected_average)
    
    def test_schema_sharing_workflow(self):
        """Test schema sharing between users"""
        # User2 saves user1's public schema
        user2 = User.objects.create_user(
            username='user2',
            email='user2@example.com',
            password='testpass123'
        )
        
        saved_schema = SavedSchema.objects.create(
            user=user2,
            original_schema=self.schema
        )
        
        # User2 uses the schema
        user2_schema = UserSchemaGrades.objects.create(
            user=user2,
            schema=self.schema
        )
        
        # Add different grades for user2
        FieldGrade.objects.create(
            user_schema=user2_schema,
            field=self.midterm,
            grade=17.0
        )
        FieldGrade.objects.create(
            user_schema=user2_schema,
            field=self.final,
            grade=19.0
        )
        
        # Calculate average (only midterm and final)
        # (17*0.3 + 19*0.4) / (0.3+0.4) = 18.14
        expected_average = 18.14
        calculated_average = user2_schema.calculate_weighted_average()
        self.assertAlmostEqual(calculated_average, expected_average, places=2)
        
        # Check usage count increased
        self.assertEqual(self.schema.usage_count, 2)  # 1 saved + 1 used
