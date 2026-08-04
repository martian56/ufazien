"""
Django Auditlog Configuration
This file registers all models for comprehensive audit logging
"""

import logging

from auditlog.registry import auditlog
from django.contrib.auth import get_user_model

# Import all your models
from blog.models import Category, Tag, BlogPost, Comment, BlogPostBookmark, BlogPostLike, BlogPostView, CommentLike
from users.models import User
from hosting.models import (
    SubscriptionPlan, UserSubscription, Domain, Database, Website, Deployment,
    SSLCertificate, BandwidthUsage, WebsiteAnalytics, BackupJob, Invoice, ActivityLog
)
from average.models import AverageSchema, SavedSchema, SchemaField, UserSchemaGrades, FieldGrade
from ai_tools.models import AITask, HumanizerTask, UserUsageStats, AIToolConfiguration
from community.models import (
    Group, GroupMembership, GroupMessage, Forum, ForumPost, PostLike, PostReply,
    PrivateChat, PrivateMessage, UserActivity
)
from game.models import Lobby, LobbyMember, PlayerPosition, StudyRoom, ChatMessage, SavedLobby
from gpa.models import AcademicYear, Semester, Course, UserGPA, CourseGrade, GPATarget, UserInputState

User = get_user_model()

# Register all models for audit logging
def register_all_models():
    """Register all models for comprehensive audit logging"""
    
    # Blog app models
    auditlog.register(Category)
    auditlog.register(Tag)
    auditlog.register(BlogPost)
    auditlog.register(Comment)
    auditlog.register(BlogPostBookmark)
    auditlog.register(BlogPostLike)
    auditlog.register(BlogPostView)
    auditlog.register(CommentLike)
    
    # Users app models
    auditlog.register(User)
    
    # Hosting app models
    auditlog.register(SubscriptionPlan)
    auditlog.register(UserSubscription)
    auditlog.register(Domain)
    auditlog.register(Database)
    auditlog.register(Website)
    auditlog.register(Deployment)
    auditlog.register(SSLCertificate)
    auditlog.register(BandwidthUsage)
    auditlog.register(WebsiteAnalytics)
    auditlog.register(BackupJob)
    auditlog.register(Invoice)
    auditlog.register(ActivityLog)
    
    # Average app models
    auditlog.register(AverageSchema)
    auditlog.register(SavedSchema)
    auditlog.register(SchemaField)
    auditlog.register(UserSchemaGrades)
    auditlog.register(FieldGrade)
    
    # AI Tools app models
    auditlog.register(AITask)
    auditlog.register(HumanizerTask)
    auditlog.register(UserUsageStats)
    auditlog.register(AIToolConfiguration)
    
    # Community app models
    auditlog.register(Group)
    auditlog.register(GroupMembership)
    auditlog.register(GroupMessage)
    auditlog.register(Forum)
    auditlog.register(ForumPost)
    auditlog.register(PostLike)
    auditlog.register(PostReply)
    auditlog.register(PrivateChat)
    auditlog.register(PrivateMessage)
    auditlog.register(UserActivity)
    
    # Game app models
    auditlog.register(Lobby)
    auditlog.register(LobbyMember)
    auditlog.register(PlayerPosition)
    auditlog.register(StudyRoom)
    auditlog.register(ChatMessage)
    auditlog.register(SavedLobby)
    
    # GPA app models
    auditlog.register(AcademicYear)
    auditlog.register(Semester)
    auditlog.register(Course)
    auditlog.register(UserGPA)
    auditlog.register(CourseGrade)
    auditlog.register(GPATarget)
    auditlog.register(UserInputState)

# Call the registration function
register_all_models()

logging.getLogger(__name__).info("All models registered for audit logging")

