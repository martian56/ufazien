from django.test import TestCase
from django.core.exceptions import ValidationError
from django.contrib.auth import get_user_model
from django.db import IntegrityError
from decimal import Decimal
from rest_framework.test import APITestCase

from .models import (
    AcademicYear, Semester, Course, UserGPA, CourseGrade, 
    GPATarget, UserInputState
)

User = get_user_model()

class AcademicYearModelTest(TestCase):
    """Test cases for AcademicYear model"""
    
    def setUp(self):
        self.year_data = {
            'name': 'L1',
            'description': 'First year',
            'order': 1
        }
    
    def test_academic_year_creation(self):
        """Test academic year is created correctly"""
        year = AcademicYear.objects.create(**self.year_data)
        
        self.assertEqual(year.name, 'L1')
        self.assertEqual(year.description, 'First year')
        self.assertEqual(year.order, 1)
        self.assertEqual(str(year), 'L1')
    
    def test_academic_year_unique_name(self):
        """Test academic year name is unique"""
        AcademicYear.objects.create(**self.year_data)
        
        with self.assertRaises(IntegrityError):
            AcademicYear.objects.create(**self.year_data)
    
    def test_academic_year_unique_order(self):
        """Test academic year order is unique"""
        AcademicYear.objects.create(**self.year_data)
        
        duplicate_order_data = {
            'name': 'L2',
            'description': 'Second year',
            'order': 1  # Same order as previous
        }
        
        with self.assertRaises(IntegrityError):
            AcademicYear.objects.create(**duplicate_order_data)
    
    def test_academic_year_ordering(self):
        """Test academic years are ordered by order field"""
        year2 = AcademicYear.objects.create(name='L2', order=2)
        year1 = AcademicYear.objects.create(name='L1', order=1)
        year3 = AcademicYear.objects.create(name='L3', order=3)
        
        years = AcademicYear.objects.all()
        self.assertEqual(list(years), [year1, year2, year3])

class SemesterModelTest(TestCase):
    """Test cases for Semester model"""
    
    def setUp(self):
        self.academic_year = AcademicYear.objects.create(
            name='L1', order=1
        )
        self.semester_data = {
            'academic_year': self.academic_year,
            'name': 'Semester 1',
            'number': 1
        }
    
    def test_semester_creation(self):
        """Test semester is created correctly"""
        semester = Semester.objects.create(**self.semester_data)
        
        self.assertEqual(semester.academic_year, self.academic_year)
        self.assertEqual(semester.name, 'Semester 1')
        self.assertEqual(semester.number, 1)
        self.assertEqual(str(semester), 'L1 - Semester 1')
    
    def test_semester_unique_together(self):
        """Test academic_year and number combination is unique"""
        Semester.objects.create(**self.semester_data)
        
        # Try to create another semester with same year and number
        with self.assertRaises(IntegrityError):
            Semester.objects.create(**self.semester_data)
    
    def test_semester_cascade_delete(self):
        """Test semester is deleted when academic year is deleted"""
        semester = Semester.objects.create(**self.semester_data)
        self.assertEqual(Semester.objects.count(), 1)
        
        self.academic_year.delete()
        self.assertEqual(Semester.objects.count(), 0)

class CourseModelTest(TestCase):
    """Test cases for Course model"""
    
    def setUp(self):
        self.academic_year = AcademicYear.objects.create(name='L1', order=1)
        self.semester = Semester.objects.create(
            academic_year=self.academic_year,
            name='Semester 1',
            number=1
        )
        self.course_data = {
            'name': 'Mathematics',
            'code': 'MATH101',
            'credits': 3.0,
            'description': 'Basic mathematics course',
            'semester': self.semester
        }
    
    def test_course_creation(self):
        """Test course is created correctly"""
        course = Course.objects.create(**self.course_data)
        
        self.assertEqual(course.name, 'Mathematics')
        self.assertEqual(course.code, 'MATH101')
        self.assertEqual(course.credits, 3.0)
        self.assertEqual(course.description, 'Basic mathematics course')
        self.assertEqual(course.semester, self.semester)
        self.assertEqual(str(course), 'MATH101 - Mathematics')
    
    def test_course_str_without_code(self):
        """Test course string representation without code"""
        course_data = self.course_data.copy()
        course_data['code'] = ''
        course = Course.objects.create(**course_data)
        
        self.assertEqual(str(course), 'Mathematics')
    
    def test_course_credits_validation(self):
        """Test course credits validation"""
        # Test minimum credits
        course_data = self.course_data.copy()
        course_data['credits'] = 0.3  # Below minimum
        
        course = Course(**course_data)
        with self.assertRaises(ValidationError):
            course.full_clean()
        
        # Test maximum credits
        course_data['credits'] = 15.0  # Above maximum
        course = Course(**course_data)
        with self.assertRaises(ValidationError):
            course.full_clean()

class UserGPAModelTest(TestCase):
    """Test cases for UserGPA model"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.user_gpa_data = {
            'user': self.user,
            'name': 'Fall 2023 GPA',
            'calculation_type': 'semester'
        }
    
    def test_user_gpa_creation(self):
        """Test UserGPA is created correctly"""
        user_gpa = UserGPA.objects.create(**self.user_gpa_data)
        
        self.assertEqual(user_gpa.user, self.user)
        self.assertEqual(user_gpa.name, 'Fall 2023 GPA')
        self.assertEqual(user_gpa.calculation_type, 'semester')
        self.assertEqual(user_gpa.total_credits, 0)
        self.assertIsNone(user_gpa.overall_gpa)
        self.assertEqual(str(user_gpa), 'testuser - Fall 2023 GPA')
    
    def test_calculate_overall_gpa_empty(self):
        """Test GPA calculation with no courses"""
        user_gpa = UserGPA.objects.create(**self.user_gpa_data)
        result = user_gpa.calculate_overall_gpa()
        
        self.assertEqual(result, 0)
        self.assertEqual(user_gpa.overall_gpa, 0)
        self.assertEqual(user_gpa.total_credits, 0)
    
    def test_calculate_overall_gpa_with_courses(self):
        """Test GPA calculation with courses"""
        user_gpa = UserGPA.objects.create(**self.user_gpa_data)
        
        # Create course grades
        CourseGrade.objects.create(
            user_gpa=user_gpa,
            course_name='Math',
            credits=3.0,
            grade_type='gpa',
            gpa_grade=3.5
        )
        CourseGrade.objects.create(
            user_gpa=user_gpa,
            course_name='Physics',
            credits=4.0,
            grade_type='gpa',
            gpa_grade=3.0
        )
        
        result = user_gpa.calculate_overall_gpa()
        expected_gpa = ((3.5 * 3.0) + (3.0 * 4.0)) / (3.0 + 4.0)  # 3.214
        
        self.assertAlmostEqual(result, expected_gpa, places=3)
        self.assertEqual(user_gpa.total_credits, 7.0)

class CourseGradeModelTest(TestCase):
    """Test cases for CourseGrade model"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.user_gpa = UserGPA.objects.create(
            user=self.user,
            name='Test GPA'
        )
        self.base_grade_data = {
            'user_gpa': self.user_gpa,
            'course_name': 'Mathematics',
            'credits': 3.0
        }
    
    def test_ufaz_grade_conversion(self):
        """Test UFAZ grade to GPA conversion"""
        # Test A+ grade (16-20)
        grade_data = self.base_grade_data.copy()
        grade_data.update({
            'grade_type': 'ufaz',
            'ufaz_grade': 18.0
        })
        course_grade = CourseGrade.objects.create(**grade_data)
        
        self.assertEqual(course_grade.gpa_points, 4.0)
        self.assertEqual(course_grade.letter_grade, 'A+')
        
        # Test A grade (13.5-16)
        course_grade.ufaz_grade = 15.0
        course_grade.save()
        
        self.assertEqual(course_grade.gpa_points, 4.0)
        self.assertEqual(course_grade.letter_grade, 'A')
        
        # Test B grade (11.5-13.5)
        course_grade.ufaz_grade = 12.5
        course_grade.save()
        
        self.assertGreaterEqual(course_grade.gpa_points, 3.0)
        self.assertLessEqual(course_grade.gpa_points, 3.7)
        self.assertIn(course_grade.letter_grade, ['B', 'B+'])
        
        # Test F grade (0-10)
        course_grade.ufaz_grade = 8.0
        course_grade.save()
        
        self.assertEqual(course_grade.gpa_points, 0.0)
        self.assertEqual(course_grade.letter_grade, 'F')
    
    def test_azerbaijan_grade_conversion(self):
        """Test Azerbaijan grade to GPA conversion"""
        grade_data = self.base_grade_data.copy()
        grade_data.update({
            'grade_type': 'azerbaijan',
            'azerbaijan_grade': 95.0
        })
        course_grade = CourseGrade.objects.create(**grade_data)
        
        self.assertEqual(course_grade.gpa_points, 4.0)
        self.assertEqual(course_grade.letter_grade, 'A')
        
        # Test other grades
        test_cases = [
            (85, 3.7, 'A-'),
            (75, 3.0, 'B'),
            (65, 2.7, 'B-'),
            (55, 2.0, 'C'),
            (45, 0.0, 'F')
        ]
        
        for az_grade, expected_gpa, expected_letter in test_cases:
            course_grade.azerbaijan_grade = az_grade
            course_grade.save()
            
            self.assertEqual(course_grade.gpa_points, expected_gpa)
            self.assertEqual(course_grade.letter_grade, expected_letter)
    
    def test_direct_gpa_grade(self):
        """Test direct GPA grade input"""
        grade_data = self.base_grade_data.copy()
        grade_data.update({
            'grade_type': 'gpa',
            'gpa_grade': 3.5
        })
        course_grade = CourseGrade.objects.create(**grade_data)
        
        self.assertEqual(course_grade.gpa_points, 3.5)
        self.assertIn(course_grade.letter_grade, ['A-', 'B+'])
    
    def test_grade_display(self):
        """Test grade display methods"""
        # UFAZ grade display
        grade_data = self.base_grade_data.copy()
        grade_data.update({
            'grade_type': 'ufaz',
            'ufaz_grade': 15.0
        })
        course_grade = CourseGrade.objects.create(**grade_data)
        self.assertEqual(course_grade.get_display_grade(), '15.0/20')
        
        # Azerbaijan grade display
        course_grade.grade_type = 'azerbaijan'
        course_grade.azerbaijan_grade = 85.0
        course_grade.save()
        self.assertEqual(course_grade.get_display_grade(), '85.0/100')
        
        # GPA grade display
        course_grade.grade_type = 'gpa'
        course_grade.gpa_grade = 3.5
        course_grade.save()
        self.assertEqual(course_grade.get_display_grade(), '3.5/4.0')

class GPATargetModelTest(TestCase):
    """Test cases for GPATarget model"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.academic_year = AcademicYear.objects.create(name='L1', order=1)
        self.semester = Semester.objects.create(
            academic_year=self.academic_year,
            name='Semester 1',
            number=1
        )
    
    def test_gpa_target_creation(self):
        """Test GPATarget is created correctly"""
        target = GPATarget.objects.create(
            user=self.user,
            target_gpa=3.5,
            target_semester=self.semester,
            description='Target for first semester'
        )
        
        self.assertEqual(target.user, self.user)
        self.assertEqual(target.target_gpa, 3.5)
        self.assertEqual(target.target_semester, self.semester)
        self.assertEqual(target.description, 'Target for first semester')
        self.assertEqual(str(target), 'testuser - Target: 3.5')
    
    def test_gpa_target_validation(self):
        """Test GPA target validation"""
        # Test minimum GPA
        target = GPATarget(
            user=self.user,
            target_gpa=-1.0
        )
        with self.assertRaises(ValidationError):
            target.full_clean()
        
        # Test maximum GPA
        target.target_gpa = 5.0
        with self.assertRaises(ValidationError):
            target.full_clean()

class UserInputStateModelTest(TestCase):
    """Test cases for UserInputState model"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
    
    def test_user_input_state_creation(self):
        """Test UserInputState is created correctly"""
        state = UserInputState.objects.create(
            user=self.user,
            active_tab='semester',
            semester_data=[{'semester': 1, 'average': 3.5}],
            yearly_data=[{'year': 'L1', 'average': 3.2}]
        )
        
        self.assertEqual(state.user, self.user)
        self.assertEqual(state.active_tab, 'semester')
        self.assertEqual(state.semester_data, [{'semester': 1, 'average': 3.5}])
        self.assertEqual(state.yearly_data, [{'year': 'L1', 'average': 3.2}])
        self.assertEqual(str(state), 'testuser - Input State')
    
    def test_user_input_state_one_to_one(self):
        """Test UserInputState one-to-one relationship with User"""
        UserInputState.objects.create(user=self.user)
        
        # Try to create another state for same user
        with self.assertRaises(IntegrityError):
            UserInputState.objects.create(user=self.user)
    
    def test_default_values(self):
        """Test default values for UserInputState"""
        state = UserInputState.objects.create(user=self.user)
        
        self.assertEqual(state.active_tab, 'semester')
        self.assertEqual(state.semester_data, [])
        self.assertEqual(state.yearly_data, [])

class GradeConversionTest(TestCase):
    """Test cases for grade conversion static methods"""
    
    def test_ufaz_to_gpa_conversion(self):
        """Test UFAZ to GPA conversion static method"""
        # Test perfect grades
        gpa, letter = CourseGrade.ufaz_to_gpa(18.0)
        self.assertEqual(gpa, 4.0)
        self.assertEqual(letter, 'A+')
        
        # Test excellent grades
        gpa, letter = CourseGrade.ufaz_to_gpa(14.0)
        self.assertEqual(gpa, 4.0)
        self.assertEqual(letter, 'A')
        
        # Test good grades
        gpa, letter = CourseGrade.ufaz_to_gpa(12.0)
        self.assertGreaterEqual(gpa, 3.0)
        self.assertLessEqual(gpa, 3.7)
        
        # Test passing grades
        gpa, letter = CourseGrade.ufaz_to_gpa(10.5)
        self.assertGreaterEqual(gpa, 2.0)
        self.assertLessEqual(gpa, 3.0)
        
        # Test failing grades
        gpa, letter = CourseGrade.ufaz_to_gpa(8.0)
        self.assertEqual(gpa, 0.0)
        self.assertEqual(letter, 'F')
    
    def test_azerbaijan_to_gpa_conversion(self):
        """Test Azerbaijan to GPA conversion static method"""
        test_cases = [
            (95, 4.0, 'A'),
            (85, 3.7, 'A-'),
            (75, 3.0, 'B'),
            (65, 2.7, 'B-'),
            (55, 2.0, 'C'),
            (45, 0.0, 'F')
        ]
        
        for az_grade, expected_gpa, expected_letter in test_cases:
            gpa, letter = CourseGrade.azerbaijan_to_gpa(az_grade)
            self.assertEqual(gpa, expected_gpa)
            self.assertEqual(letter, expected_letter)
    
    def test_gpa_to_letter_conversion(self):
        """Test GPA to letter grade conversion static method"""
        test_cases = [
            (4.0, 'A+'),
            (3.8, 'A'),
            (3.5, 'A-'),
            (3.1, 'B+'),
            (2.9, 'B'),
            (2.5, 'B-'),
            (2.1, 'C+'),
            (1.8, 'C'),
            (1.5, 'C-'),
            (1.2, 'D'),
            (0.5, 'F')
        ]
        
        for gpa, expected_letter in test_cases:
            letter = CourseGrade.gpa_to_letter(gpa)
            self.assertEqual(letter, expected_letter)


class SavedCalculationApiTests(APITestCase):
    """Deliberately saving, reopening and deleting a calculation.

    POST /gpa/calculations/ could never be used: its nested grade serializer
    used fields = '__all__', which made user_gpa a required input, and inside
    a create that is what builds the parent there is nothing to supply.
    """

    def setUp(self):
        self.user = User.objects.create_user(
            username="gpauser", email="gpa@example.com", password="pw"
        )
        self.other = User.objects.create_user(
            username="gpaother", email="gpaother@example.com", password="pw"
        )
        self.client.force_authenticate(user=self.user)

    def _payload(self, name="Third year"):
        return {
            "name": name,
            "calculation_type": "semester",
            "course_grades": [
                {"course_name": "Semester 1", "credits": 10, "grade_type": "ufaz", "ufaz_grade": 17.5},
                {"course_name": "Semester 2", "credits": 10, "grade_type": "ufaz", "ufaz_grade": 14.0},
            ],
        }

    def test_a_calculation_can_be_saved_with_a_name(self):
        response = self.client.post("/api/gpa/calculations/", self._payload(), format="json")
        self.assertEqual(response.status_code, 201, response.content[:300])

        saved = UserGPA.objects.get(user=self.user, name="Third year")
        self.assertEqual(saved.course_grades.count(), 2)
        self.assertIsNotNone(saved.overall_gpa)

    def test_saving_twice_keeps_both(self):
        """update_user_gpa overwrites one fixed name per type; this does not."""
        self.client.post("/api/gpa/calculations/", self._payload("First"), format="json")
        self.client.post("/api/gpa/calculations/", self._payload("Second"), format="json")

        self.assertEqual(UserGPA.objects.filter(user=self.user).count(), 2)

    def test_a_saved_calculation_carries_the_periods_back(self):
        self.client.post("/api/gpa/calculations/", self._payload(), format="json")

        listed = self.client.get("/api/gpa/calculations/").json()
        results = listed["results"] if isinstance(listed, dict) else listed
        grades = results[0]["course_grades"]
        self.assertEqual(
            sorted((g["course_name"], g["ufaz_grade"]) for g in grades),
            [("Semester 1", 17.5), ("Semester 2", 14.0)],
        )

    def test_a_calculation_can_be_deleted(self):
        created = self.client.post("/api/gpa/calculations/", self._payload(), format="json")
        calc_id = UserGPA.objects.get(user=self.user).id

        response = self.client.delete(f"/api/gpa/calculations/{calc_id}/")
        self.assertEqual(response.status_code, 204)
        self.assertFalse(UserGPA.objects.filter(id=calc_id).exists())

    def test_someone_elses_calculation_is_not_listed_or_reachable(self):
        self.client.post("/api/gpa/calculations/", self._payload(), format="json")
        calc_id = UserGPA.objects.get(user=self.user).id

        self.client.force_authenticate(user=self.other)
        listed = self.client.get("/api/gpa/calculations/").json()
        results = listed["results"] if isinstance(listed, dict) else listed
        self.assertEqual(results, [])
        self.assertEqual(self.client.get(f"/api/gpa/calculations/{calc_id}/").status_code, 404)
        self.assertEqual(self.client.delete(f"/api/gpa/calculations/{calc_id}/").status_code, 404)

    def test_saving_requires_authentication(self):
        self.client.force_authenticate(user=None)
        response = self.client.post("/api/gpa/calculations/", self._payload(), format="json")
        self.assertEqual(response.status_code, 401)
