from rest_framework import serializers
from .models import AcademicYear, Semester, Course, UserGPA, CourseGrade, GPATarget, UserInputState

class AcademicYearSerializer(serializers.ModelSerializer):
    class Meta:
        model = AcademicYear
        fields = '__all__'

class SemesterSerializer(serializers.ModelSerializer):
    academic_year_name = serializers.CharField(source='academic_year.name', read_only=True)
    
    class Meta:
        model = Semester
        fields = '__all__'

class CourseSerializer(serializers.ModelSerializer):
    semester_name = serializers.CharField(source='semester.name', read_only=True)
    academic_year = serializers.CharField(source='semester.academic_year.name', read_only=True)
    
    class Meta:
        model = Course
        fields = '__all__'

class CourseGradeSerializer(serializers.ModelSerializer):
    display_grade = serializers.CharField(source='get_display_grade', read_only=True)
    semester_name = serializers.CharField(source='semester.name', read_only=True)
    
    class Meta:
        model = CourseGrade
        fields = '__all__'
        read_only_fields = ('gpa_points', 'letter_grade')

class UserGPASerializer(serializers.ModelSerializer):
    course_grades = CourseGradeSerializer(many=True, read_only=True)
    course_count = serializers.SerializerMethodField()
    
    class Meta:
        model = UserGPA
        fields = '__all__'
        read_only_fields = ('user', 'overall_gpa', 'total_credits')
    
    def get_course_count(self, obj):
        return obj.course_grades.count()

class CreateUserGPASerializer(serializers.ModelSerializer):
    course_grades = CourseGradeSerializer(many=True, write_only=True)
    
    class Meta:
        model = UserGPA
        fields = ['name', 'calculation_type', 'course_grades']
    
    def create(self, validated_data):
        course_grades_data = validated_data.pop('course_grades', [])
        user_gpa = UserGPA.objects.create(
            user=self.context['request'].user,
            **validated_data
        )
        
        for course_grade_data in course_grades_data:
            CourseGrade.objects.create(user_gpa=user_gpa, **course_grade_data)
        
        # Calculate overall GPA
        user_gpa.calculate_overall_gpa()
        return user_gpa

class GPATargetSerializer(serializers.ModelSerializer):
    target_semester_name = serializers.CharField(source='target_semester.name', read_only=True)
    target_year_name = serializers.CharField(source='target_year.name', read_only=True)
    
    class Meta:
        model = GPATarget
        fields = '__all__'
        read_only_fields = ('user',)

class GPAConversionSerializer(serializers.Serializer):
    """Serializer for GPA conversion utilities"""
    grade_type = serializers.ChoiceField(choices=['ufaz', 'azerbaijan', 'gpa'])
    grade_value = serializers.FloatField()
    
    def validate(self, data):
        grade_type = data['grade_type']
        grade_value = data['grade_value']
        
        if grade_type == 'ufaz' and not (0 <= grade_value <= 20):
            raise serializers.ValidationError("UFAZ grade must be between 0 and 20")
        elif grade_type == 'azerbaijan' and not (0 <= grade_value <= 100):
            raise serializers.ValidationError("Azerbaijan grade must be between 0 and 100")
        elif grade_type == 'gpa' and not (0 <= grade_value <= 4.0):
            raise serializers.ValidationError("GPA must be between 0 and 4.0")
        
        return data


class UserInputStateSerializer(serializers.ModelSerializer):
    """Serializer for saving and loading user's input state"""
    
    class Meta:
        model = UserInputState
        fields = ['active_tab', 'semester_data', 'yearly_data', 'updated_at']
        read_only_fields = ('updated_at',)