from django.contrib import admin
from .models import AcademicYear, Semester, Course, UserGPA, CourseGrade, GPATarget, UserInputState

@admin.register(AcademicYear)
class AcademicYearAdmin(admin.ModelAdmin):
    list_display = ['name', 'description']
    search_fields = ['name']

@admin.register(Semester)
class SemesterAdmin(admin.ModelAdmin):
    list_display = ['name', 'academic_year', 'number']
    list_filter = ['academic_year']
    search_fields = ['name']

@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'semester', 'credits']
    list_filter = ['semester', 'credits']
    search_fields = ['name', 'code']

@admin.register(UserGPA)
class UserGPAAdmin(admin.ModelAdmin):
    list_display = ['user', 'name', 'calculation_type', 'overall_gpa', 'total_credits', 'updated_at']
    list_filter = ['calculation_type', 'updated_at']
    search_fields = ['user__username', 'name']
    readonly_fields = ['overall_gpa', 'total_credits', 'created_at', 'updated_at']

@admin.register(CourseGrade)
class CourseGradeAdmin(admin.ModelAdmin):
    list_display = ['user_gpa', 'course_name', 'grade_type', 'gpa_points', 'letter_grade']
    list_filter = ['grade_type', 'letter_grade']
    search_fields = ['course_name', 'user_gpa__user__username']
    readonly_fields = ['gpa_points', 'letter_grade']

@admin.register(GPATarget)
class GPATargetAdmin(admin.ModelAdmin):
    list_display = ['user', 'target_gpa', 'target_semester', 'target_year', 'created_at']
    list_filter = ['target_semester', 'target_year', 'created_at']
    search_fields = ['user__username', 'description']

@admin.register(UserInputState)
class UserInputStateAdmin(admin.ModelAdmin):
    list_display = ['user', 'active_tab', 'updated_at']
    list_filter = ['active_tab', 'updated_at']
    search_fields = ['user__username']
    readonly_fields = ['updated_at']
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('user')
