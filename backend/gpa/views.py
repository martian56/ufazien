from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from django.db.models import Avg, Sum, Count, Max, Min
from .models import AcademicYear, Semester, Course, UserGPA, CourseGrade, GPATarget, UserInputState
from .serializers import (
    AcademicYearSerializer, SemesterSerializer, CourseSerializer,
    UserGPASerializer, CreateUserGPASerializer, CourseGradeSerializer,
    GPATargetSerializer, GPAConversionSerializer, UserInputStateSerializer
)

class GPAPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100

class AcademicYearList(generics.ListAPIView):
    """List all academic years (L1, L2, L3)"""
    queryset = AcademicYear.objects.all()
    serializer_class = AcademicYearSerializer
    permission_classes = [IsAuthenticated]

class SemesterList(generics.ListAPIView):
    """List semesters, optionally filtered by academic year"""
    serializer_class = SemesterSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        queryset = Semester.objects.all()
        academic_year = self.request.query_params.get('academic_year')
        if academic_year:
            queryset = queryset.filter(academic_year__name=academic_year)
        return queryset

class UserGPAList(generics.ListCreateAPIView):
    """List and create user's GPA calculations"""
    permission_classes = [IsAuthenticated]
    pagination_class = GPAPagination
    
    def get_queryset(self):
        return UserGPA.objects.filter(user=self.request.user)
    
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return CreateUserGPASerializer
        return UserGPASerializer

class UserGPADetail(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update or delete a specific GPA calculation"""
    serializer_class = UserGPASerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return UserGPA.objects.filter(user=self.request.user)

class CourseGradeList(generics.ListCreateAPIView):
    """List and create course grades for a specific GPA calculation"""
    serializer_class = CourseGradeSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        user_gpa_id = self.kwargs.get('user_gpa_id')
        return CourseGrade.objects.filter(
            user_gpa_id=user_gpa_id,
            user_gpa__user=self.request.user
        )
    
    def perform_create(self, serializer):
        user_gpa_id = self.kwargs.get('user_gpa_id')
        user_gpa = UserGPA.objects.get(
            id=user_gpa_id,
            user=self.request.user
        )
        course_grade = serializer.save(user_gpa=user_gpa)
        # Recalculate overall GPA
        user_gpa.calculate_overall_gpa()

class CourseGradeDetail(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update or delete a specific course grade"""
    serializer_class = CourseGradeSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return CourseGrade.objects.filter(user_gpa__user=self.request.user)
    
    def perform_update(self, serializer):
        course_grade = serializer.save()
        # Recalculate overall GPA
        course_grade.user_gpa.calculate_overall_gpa()
    
    def perform_destroy(self, instance):
        user_gpa = instance.user_gpa
        instance.delete()
        # Recalculate overall GPA
        user_gpa.calculate_overall_gpa()

class GPATargetList(generics.ListCreateAPIView):
    """List and create GPA targets"""
    serializer_class = GPATargetSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return GPATarget.objects.filter(user=self.request.user)
    
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def convert_grade(request):
    """Convert between different grading systems"""
    serializer = GPAConversionSerializer(data=request.data)
    if serializer.is_valid():
        grade_type = serializer.validated_data['grade_type']
        grade_value = serializer.validated_data['grade_value']
        
        result = {
            'original_grade': grade_value,
            'grade_type': grade_type
        }
        
        if grade_type == 'ufaz':
            gpa_points, letter_grade = CourseGrade.ufaz_to_gpa(grade_value)
            result.update({
                'gpa_points': gpa_points,
                'letter_grade': letter_grade,
                'azerbaijan_equivalent': ufaz_to_azerbaijan(grade_value),
                'status': get_ufaz_status(grade_value)
            })
        elif grade_type == 'azerbaijan':
            gpa_points, letter_grade = CourseGrade.azerbaijan_to_gpa(grade_value)
            result.update({
                'gpa_points': gpa_points,
                'letter_grade': letter_grade,
                'ufaz_equivalent': azerbaijan_to_ufaz(grade_value)
            })
        elif grade_type == 'gpa':
            letter_grade = CourseGrade.gpa_to_letter(grade_value)
            result.update({
                'letter_grade': letter_grade,
                'ufaz_equivalent': gpa_to_ufaz(grade_value),
                'azerbaijan_equivalent': gpa_to_azerbaijan(grade_value)
            })
        
        return Response(result, status=status.HTTP_200_OK)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def gpa_statistics(request):
    """Get user's GPA statistics"""
    user_gpas = UserGPA.objects.filter(user=request.user)
    
    if not user_gpas.exists():
        return Response({
            'message': 'No GPA records found',
            'statistics': {}
        }, status=status.HTTP_200_OK)
    
    # Calculate statistics
    stats = user_gpas.aggregate(
        highest_gpa=Max('overall_gpa'),
        lowest_gpa=Min('overall_gpa'),
        average_gpa=Avg('overall_gpa'),
        total_calculations=Count('id'),
        total_credits=Sum('total_credits')
    )
    
    # Get recent calculations
    recent_calculations = UserGPASerializer(
        user_gpas.order_by('-updated_at')[:5],
        many=True
    ).data
    
    # Calculate semester-wise progress if available
    semester_progress = []
    for gpa_record in user_gpas.filter(calculation_type='semester').order_by('-updated_at'):
        semester_data = {
            'name': gpa_record.name,
            'gpa': gpa_record.overall_gpa,
            'credits': gpa_record.total_credits,
            'date': gpa_record.updated_at.date()
        }
        semester_progress.append(semester_data)
    
    result = {
        'statistics': {
            **stats,
            'highest_gpa': round(stats['highest_gpa'] or 0, 3),
            'lowest_gpa': round(stats['lowest_gpa'] or 0, 3),
            'average_gpa': round(stats['average_gpa'] or 0, 3),
        },
        'recent_calculations': recent_calculations,
        'semester_progress': semester_progress[:10]  # Last 10 semesters
    }
    
    return Response(result, status=status.HTTP_200_OK)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def grade_distribution(request):
    """Get grade distribution for user's courses"""
    course_grades = CourseGrade.objects.filter(user_gpa__user=request.user)
    
    if not course_grades.exists():
        return Response({
            'message': 'No course grades found',
            'distribution': {}
        }, status=status.HTTP_200_OK)
    
    # Calculate grade distribution
    distribution = {}
    total_courses = 0
    
    for grade in course_grades:
        if grade.letter_grade:
            letter = grade.letter_grade
            if letter not in distribution:
                distribution[letter] = {'count': 0, 'percentage': 0}
            distribution[letter]['count'] += 1
            total_courses += 1
    
    # Calculate percentages
    for letter in distribution:
        distribution[letter]['percentage'] = round(
            (distribution[letter]['count'] / total_courses) * 100, 1
        )
    
    # Sort by GPA value
    grade_order = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'F']
    sorted_distribution = {
        grade: distribution[grade] 
        for grade in grade_order 
        if grade in distribution
    }
    
    return Response({
        'distribution': sorted_distribution,
        'total_courses': total_courses
    }, status=status.HTTP_200_OK)

# Helper functions for grade conversions
def ufaz_to_azerbaijan(ufaz_grade):
    """Convert UFAZ grade to Azerbaijan 100-point system"""
    if ufaz_grade >= 16:
        return min(100, 90 + (ufaz_grade - 16) * 2.5)  # 90-100
    elif ufaz_grade >= 13.5:
        return 80 + (ufaz_grade - 13.5) * 4  # 80-90
    elif ufaz_grade >= 11.5:
        return 70 + (ufaz_grade - 11.5) * 5  # 70-80
    elif ufaz_grade >= 10:
        return 50 + (ufaz_grade - 10) * 13.33  # 50-70
    else:
        return max(0, ufaz_grade * 5)  # 0-50

def azerbaijan_to_ufaz(az_grade):
    """Convert Azerbaijan grade to UFAZ 20-point system"""
    if az_grade >= 90:
        return 16 + (az_grade - 90) * 0.4  # 16-20
    elif az_grade >= 80:
        return 13.5 + (az_grade - 80) * 0.25  # 13.5-16
    elif az_grade >= 70:
        return 11.5 + (az_grade - 70) * 0.2  # 11.5-13.5
    elif az_grade >= 50:
        return 10 + (az_grade - 50) * 0.075  # 10-11.5
    else:
        return max(0, az_grade * 0.2)  # 0-10

def gpa_to_ufaz(gpa):
    """Convert GPA to UFAZ grade (approximate)"""
    if gpa >= 3.85:
        return 18 + (gpa - 3.85) * 13.33  # 18-20
    elif gpa >= 3.7:
        return 16 + (gpa - 3.7) * 13.33  # 16-18
    elif gpa >= 3.0:
        return 13.5 + (gpa - 3.0) * 3.57  # 13.5-16
    elif gpa >= 2.0:
        return 11.5 + (gpa - 2.0) * 2  # 11.5-13.5
    else:
        return max(0, 10 + gpa * 5)  # 0-10

def gpa_to_azerbaijan(gpa):
    """Convert GPA to Azerbaijan grade"""
    return ufaz_to_azerbaijan(gpa_to_ufaz(gpa))

def get_ufaz_status(ufaz_grade):
    """Get status description for UFAZ grade"""
    if ufaz_grade >= 16:
        return "Perfect"
    elif ufaz_grade >= 13.5:
        return "Excellent"
    elif ufaz_grade >= 11.5:
        return "Good"
    elif ufaz_grade >= 10:
        return "Enough"
    else:
        return "Fail"

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_user_gpa(request):
    """Update user's GPA with simplified period-based averages"""
    period_type = request.data.get('period_type')  # 'semester' or 'yearly'
    period_averages = request.data.get('period_averages', [])
    
    if not period_type or not period_averages:
        return Response({
            'error': 'period_type and period_averages are required'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Get or create a UserGPA record for this calculation type
    user_gpa, created = UserGPA.objects.get_or_create(
        user=request.user,
        calculation_type=period_type,
        name=f"Auto-saved {period_type.title()} GPA",
        defaults={}
    )
    
    # Clear existing course grades for this calculation
    user_gpa.course_grades.all().delete()
    
    # Create course grades from period averages
    total_credits = 0
    for period in period_averages:
        period_name = period.get('name', 'Period')
        average = period.get('average')
        credits = period.get('credits', 30)  # Default credits per period
        
        if average is not None and average > 0:
            # Convert average to GPA points using UFAZ system
            gpa_points, letter_grade = CourseGrade.ufaz_to_gpa(average)
            
            # Create a course grade entry for this period
            CourseGrade.objects.create(
                user_gpa=user_gpa,
                course_name=period_name,
                credits=credits,
                grade_type='ufaz',
                ufaz_grade=average,
                gpa_points=gpa_points,
                letter_grade=letter_grade
            )
            total_credits += credits
    
    # Update total credits and calculate overall GPA
    user_gpa.total_credits = total_credits
    overall_gpa = user_gpa.calculate_overall_gpa()
    
    # Update user's main GPA field
    user = request.user
    user.gpa = overall_gpa
    user.save()
    
    return Response({
        'success': True,
        'overall_gpa': overall_gpa,
        'total_credits': total_credits,
        'user_gpa_id': user_gpa.id,
        'message': f'{period_type.title()} GPA updated successfully'
    }, status=status.HTTP_200_OK)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def user_input_state(request):
    """Get or save user's input state for GPA calculator"""
    if request.method == 'GET':
        # Get user's current input state
        try:
            input_state = UserInputState.objects.get(user=request.user)
            serializer = UserInputStateSerializer(input_state)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except UserInputState.DoesNotExist:
            # Return default state if none exists
            default_data = {
                'active_tab': 'semester',
                'semester_data': [{'id': 1, 'period': '', 'average': '', 'gradeType': 'ufaz'}],
                'yearly_data': [{'id': 1, 'period': '', 'average': '', 'gradeType': 'ufaz'}],
                'updated_at': None
            }
            return Response(default_data, status=status.HTTP_200_OK)
    
    elif request.method == 'POST':
        # Save user's input state
        try:
            input_state = UserInputState.objects.get(user=request.user)
            serializer = UserInputStateSerializer(input_state, data=request.data, partial=True)
        except UserInputState.DoesNotExist:
            serializer = UserInputStateSerializer(data=request.data)
        
        if serializer.is_valid():
            if hasattr(serializer, 'instance') and serializer.instance:
                # Update existing
                serializer.save()
            else:
                # Create new
                serializer.save(user=request.user)
            
            return Response({
                'success': True,
                'message': 'Input state saved successfully',
                'data': serializer.data
            }, status=status.HTTP_200_OK)
        
        return Response({
            'success': False,
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)
