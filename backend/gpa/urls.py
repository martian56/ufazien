from django.urls import path
from . import views

urlpatterns = [
    # Academic structure
    path('academic-years/', views.AcademicYearList.as_view(), name='academic-years'),
    path('semesters/', views.SemesterList.as_view(), name='semesters'),
    
    # GPA calculations
    path('calculations/', views.UserGPAList.as_view(), name='user-gpa-list'),
    path('calculations/<int:pk>/', views.UserGPADetail.as_view(), name='user-gpa-detail'),
    
    # Course grades
    path('calculations/<int:user_gpa_id>/grades/', views.CourseGradeList.as_view(), name='course-grade-list'),
    path('grades/<int:pk>/', views.CourseGradeDetail.as_view(), name='course-grade-detail'),
    
    # GPA targets
    path('targets/', views.GPATargetList.as_view(), name='gpa-targets'),
    
    # Simplified GPA update
    path('update-user-gpa/', views.update_user_gpa, name='update-user-gpa'),
    
    # User input state (save/load form data)
    path('input-state/', views.user_input_state, name='user-input-state'),
    
    # Utilities
    path('convert-grade/', views.convert_grade, name='convert-grade'),
    path('statistics/', views.gpa_statistics, name='gpa-statistics'),
    path('grade-distribution/', views.grade_distribution, name='grade-distribution'),
]