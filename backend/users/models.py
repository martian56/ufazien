from django.db import models
from django.contrib.auth.models import AbstractUser

"""
# UFAZ Offers Bachelor's Degree Programs in 
# Computer Science, Chemistry, Chemical Engineering,
# Oil and Gas Engineering, and Geophysical Engineering.

# Create Major Enum
"""
class Major(models.TextChoices):
    COMPUTER_SCIENCE = 'CS', 'Computer Science'
    CHEMISTRY = 'CH', 'Chemistry'
    CHEMICAL_ENGINEERING = 'CE', 'Chemical Engineering'
    OIL_AND_GAS_ENGINEERING = 'OGE', 'Oil and Gas Engineering'
    GEOPHYSICAL_ENGINEERING = 'GE', 'Geophysical Engineering'
    UNDECLARED = 'UD', 'Undeclared'


class User(AbstractUser):
    followers = models.ManyToManyField(
        'self', symmetrical=False, related_name='following', blank=True
    )
    bio = models.TextField(max_length=500, blank=True, null=True)
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    year = models.CharField(max_length=2, default='1')
    major = models.CharField(
        max_length=3,
        choices=Major.choices,
        default=Major.UNDECLARED,
    )
    gpa = models.DecimalField(max_digits=3, decimal_places=2, default=0.00)
    completed_credits = models.PositiveIntegerField(default=0)

    def __str__(self):
        return self.get_full_name()
    
    