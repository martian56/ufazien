from django.db import models
from django.contrib.auth import get_user_model
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator

User = get_user_model()

class AcademicYear(models.Model):
    """Model for academic years (L1, L2, L3)"""
    name = models.CharField(max_length=10, unique=True)  # L1, L2, L3
    description = models.CharField(max_length=100, blank=True)
    order = models.PositiveIntegerField(unique=True)
    
    class Meta:
        ordering = ['order']
    
    def __str__(self):
        return self.name

class Semester(models.Model):
    """Model for semesters within each academic year"""
    academic_year = models.ForeignKey(AcademicYear, on_delete=models.CASCADE, related_name='semesters')
    name = models.CharField(max_length=20)  # Semester 1, Semester 2
    number = models.PositiveIntegerField()  # 1 or 2
    
    class Meta:
        unique_together = ('academic_year', 'number')
        ordering = ['academic_year__order', 'number']
    
    def __str__(self):
        return f"{self.academic_year.name} - {self.name}"

class Course(models.Model):
    """Model for courses/subjects"""
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=20, unique=True, blank=True)
    credits = models.FloatField(validators=[MinValueValidator(0.5), MaxValueValidator(10)])
    description = models.TextField(blank=True)
    semester = models.ForeignKey(Semester, on_delete=models.CASCADE, related_name='courses')
    
    def __str__(self):
        return f"{self.code} - {self.name}" if self.code else self.name

class UserGPA(models.Model):
    """Main model for user's GPA calculation records"""
    CALCULATION_TYPE_CHOICES = [
        ('semester', 'Semester-based'),
        ('yearly', 'Yearly Average'),
    ]
    
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='gpa_records')
    name = models.CharField(max_length=100)  # User-defined name for this calculation
    calculation_type = models.CharField(max_length=10, choices=CALCULATION_TYPE_CHOICES, default='semester')
    overall_gpa = models.FloatField(null=True, blank=True)
    total_credits = models.FloatField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-updated_at']
    
    def __str__(self):
        return f"{self.user.username} - {self.name}"
    
    def calculate_overall_gpa(self):
        """Calculate overall GPA based on all courses"""
        total_grade_points = 0
        total_credits = 0
        
        for course_grade in self.course_grades.all():
            if course_grade.gpa_points is not None:
                total_grade_points += course_grade.gpa_points * course_grade.credits
                total_credits += course_grade.credits
        
        if total_credits > 0:
            self.overall_gpa = round(total_grade_points / total_credits, 3)
            self.total_credits = total_credits
        else:
            self.overall_gpa = 0
            self.total_credits = 0
        
        self.save()
        return self.overall_gpa

class CourseGrade(models.Model):
    """Model for individual course grades within a GPA calculation"""
    GRADE_TYPE_CHOICES = [
        ('ufaz', 'UFAZ (20-point)'),
        ('azerbaijan', 'Azerbaijan (100-point)'),
        ('gpa', 'Direct GPA (4.0 scale)'),
    ]
    
    user_gpa = models.ForeignKey(UserGPA, on_delete=models.CASCADE, related_name='course_grades')
    course_name = models.CharField(max_length=100)
    # A row here is either one course or a whole period, because the
    # semester and yearly calculators store each period as a "course". A UFAZ
    # semester is 30 ECTS and a year is 60, so the old cap of 10 was the
    # single-course figure and update_user_gpa wrote 30 straight past it
    # through the ORM, which skips validation. Widened to fit what is actually
    # stored; Course.credits keeps the 10 that is right for one course.
    credits = models.FloatField(validators=[MinValueValidator(0.5), MaxValueValidator(60)])
    grade_type = models.CharField(max_length=15, choices=GRADE_TYPE_CHOICES, default='ufaz')
    
    # Grade values based on type
    ufaz_grade = models.FloatField(null=True, blank=True, validators=[MinValueValidator(0), MaxValueValidator(20)])
    azerbaijan_grade = models.FloatField(null=True, blank=True, validators=[MinValueValidator(0), MaxValueValidator(100)])
    gpa_grade = models.FloatField(null=True, blank=True, validators=[MinValueValidator(0), MaxValueValidator(4.0)])
    
    # Calculated values
    gpa_points = models.FloatField(null=True, blank=True)  # Final GPA points for this course
    letter_grade = models.CharField(max_length=3, blank=True)
    
    # Optional associations
    semester = models.ForeignKey(Semester, on_delete=models.SET_NULL, null=True, blank=True)
    
    def save(self, *args, **kwargs):
        """Calculate GPA points and letter grade before saving"""
        self.calculate_gpa_points()
        super().save(*args, **kwargs)
    
    def calculate_gpa_points(self):
        """Convert grade to GPA points based on grade type"""
        if self.grade_type == 'ufaz' and self.ufaz_grade is not None:
            self.gpa_points, self.letter_grade = self.ufaz_to_gpa(self.ufaz_grade)
        elif self.grade_type == 'azerbaijan' and self.azerbaijan_grade is not None:
            self.gpa_points, self.letter_grade = self.azerbaijan_to_gpa(self.azerbaijan_grade)
        elif self.grade_type == 'gpa' and self.gpa_grade is not None:
            self.gpa_points = self.gpa_grade
            self.letter_grade = self.gpa_to_letter(self.gpa_grade)
        else:
            self.gpa_points = None
            self.letter_grade = ""
    
    @staticmethod
    def ufaz_to_gpa(ufaz_grade):
        """Convert UFAZ 20-point grade to GPA using French system conversion"""
        if ufaz_grade >= 16:  # Perfect (16-20)
            return 4.0, "A+"
        elif ufaz_grade >= 13.5:  # Excellent (13.5-16)
            return 4.0, "A"
        elif ufaz_grade >= 11.5:  # Good (11.5-13.5)
            # Linear interpolation between 3.0 and 3.7
            gpa = 3.0 + ((ufaz_grade - 11.5) / 2.0) * 0.7
            return round(gpa, 2), "B+" if gpa >= 3.3 else "B"
        elif ufaz_grade >= 10:  # Enough (10-11.5)
            # Linear interpolation between 2.0 and 3.0
            gpa = 2.0 + ((ufaz_grade - 10) / 1.5) * 1.0
            return round(gpa, 2), "C+" if gpa >= 2.3 else "C"
        else:  # Fail (0-10)
            return 0.0, "F"
    
    @staticmethod
    def azerbaijan_to_gpa(az_grade):
        """Convert Azerbaijan 100-point grade to GPA"""
        if az_grade >= 90:
            return 4.0, "A"
        elif az_grade >= 80:
            return 3.7, "A-"
        elif az_grade >= 70:
            return 3.0, "B"
        elif az_grade >= 60:
            return 2.7, "B-"
        elif az_grade >= 50:
            return 2.0, "C"
        else:
            return 0.0, "F"
    
    @staticmethod
    def gpa_to_letter(gpa):
        """Convert GPA points to letter grade"""
        if gpa >= 3.85:
            return "A+"
        elif gpa >= 3.7:
            return "A"
        elif gpa >= 3.3:
            return "A-"
        elif gpa >= 3.0:
            return "B+"
        elif gpa >= 2.7:
            return "B"
        elif gpa >= 2.3:
            return "B-"
        elif gpa >= 2.0:
            return "C+"
        elif gpa >= 1.7:
            return "C"
        elif gpa >= 1.3:
            return "C-"
        elif gpa >= 1.0:
            return "D"
        else:
            return "F"
    
    def __str__(self):
        return f"{self.course_name} - {self.get_display_grade()}"
    
    def get_display_grade(self):
        """Get the appropriate grade for display"""
        if self.grade_type == 'ufaz':
            return f"{self.ufaz_grade}/20"
        elif self.grade_type == 'azerbaijan':
            return f"{self.azerbaijan_grade}/100"
        elif self.grade_type == 'gpa':
            return f"{self.gpa_grade}/4.0"
        return "No grade"

class GPATarget(models.Model):
    """Model for user's GPA targets and goals"""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='gpa_targets')
    target_gpa = models.FloatField(validators=[MinValueValidator(0), MaxValueValidator(4.0)])
    target_semester = models.ForeignKey(Semester, on_delete=models.CASCADE, null=True, blank=True)
    target_year = models.ForeignKey(AcademicYear, on_delete=models.CASCADE, null=True, blank=True)
    description = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.user.username} - Target: {self.target_gpa}"


class UserInputState(models.Model):
    """Model to store user's current input state for GPA calculator"""
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='gpa_input_state')
    active_tab = models.CharField(max_length=20, choices=[('semester', 'Semester'), ('yearly', 'Yearly'), ('history', 'History')], default='semester')
    semester_data = models.JSONField(default=list, blank=True)  # Stores semester averages array
    yearly_data = models.JSONField(default=list, blank=True)    # Stores yearly averages array
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "User Input State"
        verbose_name_plural = "User Input States"
    
    def __str__(self):
        return f"{self.user.username} - Input State"
