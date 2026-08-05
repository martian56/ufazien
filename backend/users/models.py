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
    
    


class UserSettings(models.Model):
    """Preferences that belong to one user.

    These lived in localStorage under keys like "ufaz_notification_settings",
    which meant they were per-browser: signing in on a phone, or clearing site
    data, silently reset every one of them. Same shape of bug as the blog
    drafts that used to live under a single localStorage key.

    Only settings the application can actually honour are stored. There is no
    two-factor field, because there is no two-factor authentication; a stored
    `twoFactorAuth: true` would be a claim the login flow does not keep.
    """

    class ProfileVisibility(models.TextChoices):
        EVERYONE = "everyone", "Everyone"
        FOLLOWERS = "followers", "People who follow me"
        NOBODY = "nobody", "Nobody"

    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name="settings"
    )

    # Academic
    grade_system = models.CharField(max_length=20, default="ufaz")
    default_credits = models.PositiveSmallIntegerField(default=3)
    semester_goal = models.PositiveSmallIntegerField(default=85)
    show_gpa = models.BooleanField(default=True)
    study_goal_hours = models.PositiveSmallIntegerField(default=25)

    # Notifications
    email_notifications = models.BooleanField(default=True)
    assignment_reminders = models.BooleanField(default=True)
    grade_updates = models.BooleanField(default=True)
    community_messages = models.BooleanField(default=True)
    event_reminders = models.BooleanField(default=True)
    weekly_reports = models.BooleanField(default=False)

    # Privacy
    profile_visibility = models.CharField(
        max_length=20,
        choices=ProfileVisibility.choices,
        default=ProfileVisibility.EVERYONE,
    )
    show_schedule = models.BooleanField(default=True)
    allow_messages = models.BooleanField(default=True)
    show_online_status = models.BooleanField(default=True)

    # Appearance
    theme = models.CharField(max_length=10, default="light")
    language = models.CharField(max_length=10, default="en")
    date_format = models.CharField(max_length=20, default="DD/MM/YYYY")
    time_format = models.CharField(max_length=5, default="24h")

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "user settings"

    def __str__(self):
        return f"Settings for {self.user.username}"
