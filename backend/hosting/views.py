from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required
from django.utils.decorators import method_decorator
from django.utils import timezone
from django.db.models import Q, Sum, Count
from django.core.paginator import Paginator
from django.core.exceptions import ValidationError
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import ValidationError as DRFValidationError
from datetime import datetime, timedelta
import json
import uuid

from .models import (
    SubscriptionPlan, UserSubscription, Website, Database, Domain,
    Deployment, SSLCertificate, BandwidthUsage, WebsiteAnalytics,
    BackupJob, Invoice, ActivityLog
)
from .serializers import (
    SubscriptionPlanSerializer, UserSubscriptionSerializer, WebsiteSerializer,
    DatabaseSerializer, DomainSerializer, DeploymentSerializer,
    SSLCertificateSerializer, WebsiteAnalyticsSerializer, BackupJobSerializer,
    InvoiceSerializer, ActivityLogSerializer
)


class SubscriptionPlanViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for subscription plans - read only for users to see available plans
    """
    queryset = SubscriptionPlan.objects.all()
    serializer_class = SubscriptionPlanSerializer
    permission_classes = [permissions.IsAuthenticated]


class UserSubscriptionViewSet(viewsets.ModelViewSet):
    """
    ViewSet for user subscriptions
    """
    serializer_class = UserSubscriptionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return UserSubscription.objects.filter(user=self.request.user)

    @action(detail=False, methods=['get'])
    def current(self, request):
        """Get current user subscription"""
        try:
            subscription = UserSubscription.objects.get(user=request.user)
            serializer = self.get_serializer(subscription)
            data = serializer.data
            data['usage_stats'] = subscription.get_usage_stats()
            return Response(data)
        except UserSubscription.DoesNotExist:
            # Create default free subscription
            free_plan = SubscriptionPlan.objects.get(name='free')
            subscription = UserSubscription.objects.create(
                user=request.user,
                plan=free_plan
            )
            serializer = self.get_serializer(subscription)
            data = serializer.data
            data['usage_stats'] = subscription.get_usage_stats()
            return Response(data)

    @action(detail=False, methods=['post'])
    def upgrade(self, request):
        """Upgrade user subscription"""
        plan_name = request.data.get('plan')
        try:
            new_plan = SubscriptionPlan.objects.get(name=plan_name)
            subscription, created = UserSubscription.objects.get_or_create(
                user=request.user,
                defaults={'plan': new_plan}
            )
            if not created:
                subscription.plan = new_plan
                subscription.save()
                
            # Log activity
            ActivityLog.objects.create(
                user=request.user,
                action='subscription_upgraded',
                description=f'Upgraded to {new_plan.display_name}',
                ip_address=request.META.get('REMOTE_ADDR'),
                user_agent=request.META.get('HTTP_USER_AGENT', ''),
            )
            
            serializer = self.get_serializer(subscription)
            return Response(serializer.data)
        except SubscriptionPlan.DoesNotExist:
            return Response(
                {'error': 'Invalid subscription plan'},
                status=status.HTTP_400_BAD_REQUEST
            )


class WebsiteViewSet(viewsets.ModelViewSet):
    """
    ViewSet for user websites
    """
    serializer_class = WebsiteSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Website.objects.filter(user=self.request.user).order_by('-created_at')

    def create(self, request, *args, **kwargs):
        """Override create to add debugging"""
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        # Check subscription limits
        try:
            user_subscription = UserSubscription.objects.get(user=self.request.user)
        except UserSubscription.DoesNotExist:
            # Create a free subscription if user doesn't have one
            try:
                free_plan = SubscriptionPlan.objects.get(name='free')
                user_subscription = UserSubscription.objects.create(
                    user=self.request.user,
                    plan=free_plan
                )
            except SubscriptionPlan.DoesNotExist:
                raise DRFValidationError('Free subscription plan not found. Please contact support.')
        
        current_websites = Website.objects.filter(
            user=self.request.user,
            status__in=['active', 'building']
        ).count()
        
        if current_websites >= user_subscription.plan.max_websites:
            raise DRFValidationError(
                f'Website limit exceeded. Upgrade your plan to create more websites.'
            )
        
        # Handle domain assignment
        domain_id = serializer.validated_data.pop('domain_id', None)
        new_domain_name = serializer.validated_data.pop('new_domain_name', None)
        domain = None
        
        if domain_id:
            try:
                # Verify that the domain belongs to the user and is available
                domain = Domain.objects.get(id=domain_id, user=self.request.user)
                
                # Check if domain is already in use
                if Website.objects.filter(domain=domain).exists():
                    raise DRFValidationError(f'Domain {domain.name} is already in use by another website.')
                    
            except Domain.DoesNotExist:
                raise DRFValidationError('Invalid domain ID or domain does not belong to you.')
        
        elif new_domain_name:
            # Create a new domain
            domain_type = 'custom' if not new_domain_name.endswith('.ufazien.com') else 'subdomain'
            domain = Domain.objects.create(
                name=new_domain_name,
                domain_type=domain_type,
                user=self.request.user,
                status='active'
            )
            
            # Automatically create SSL certificate for the new domain
            try:
                ssl_certificate = SSLCertificate.objects.create(
                    domain=domain,
                    status='pending',
                    issuer='Let\'s Encrypt',
                    auto_renew=True
                )
                
                # Simulate SSL certificate processing
                ssl_certificate.issued_at = timezone.now()
                ssl_certificate.expires_at = timezone.now() + timedelta(days=90)
                ssl_certificate.status = 'active'
                ssl_certificate.save()
                
                # Update domain SSL status
                domain.ssl_enabled = True
                domain.ssl_expires_at = ssl_certificate.expires_at
                domain.save()
                
                # Log SSL certificate creation
                ActivityLog.objects.create(
                    user=self.request.user,
                    action='ssl_issued',
                    description=f'Automatically issued SSL certificate for new domain: {domain.name}',
                    ip_address=self.request.META.get('REMOTE_ADDR'),
                    user_agent=self.request.META.get('HTTP_USER_AGENT', ''),
                    metadata={
                        'domain_id': str(domain.id),
                        'ssl_certificate_id': str(ssl_certificate.id),
                        'auto_created': True,
                        'created_during_website_creation': True
                    }
                )
            except Exception as e:
                # Log error but don't fail domain/website creation
                ActivityLog.objects.create(
                    user=self.request.user,
                    action='ssl_issue_failed',
                    description=f'Failed to automatically create SSL certificate for new domain: {domain.name}. Error: {str(e)}',
                    ip_address=self.request.META.get('REMOTE_ADDR'),
                    user_agent=self.request.META.get('HTTP_USER_AGENT', ''),
                    metadata={
                        'domain_id': str(domain.id),
                        'error': str(e),
                        'created_during_website_creation': True
                    }
                )
            
            # Log domain creation
            ActivityLog.objects.create(
                user=self.request.user,
                action='domain_added',
                description=f'Created new domain during website creation: {domain.name}',
                ip_address=self.request.META.get('REMOTE_ADDR'),
                user_agent=self.request.META.get('HTTP_USER_AGENT', ''),
                metadata={
                    'domain_id': str(domain.id),
                    'created_during_website_creation': True
                }
            )

        # Handle database assignment
        database_id = serializer.validated_data.pop('database_id', None)
        database = None
        
        if database_id:
            try:
                # Verify that the database belongs to the user
                database = Database.objects.get(id=database_id, user=self.request.user)
                
                # Check if database is already in use
                if Website.objects.filter(database=database).exists():
                    raise DRFValidationError(f'Database {database.name} is already in use by another website.')
                    
            except Database.DoesNotExist:
                raise DRFValidationError('Invalid database ID or database does not belong to you.')
        
        website = serializer.save(user=self.request.user, domain=domain, database=database)
        
        # Log activity
        ActivityLog.objects.create(
            user=self.request.user,
            action='website_created',
            description=f'Created website: {website.name}',
            ip_address=self.request.META.get('REMOTE_ADDR'),
            user_agent=self.request.META.get('HTTP_USER_AGENT', ''),
            metadata={'website_id': str(website.id)}
        )

    def perform_update(self, serializer):
        """Log website updates"""
        instance = self.get_object()
        old_data = {
            'name': instance.name,
            'description': instance.description,
            'website_type': instance.website_type,
            'status': instance.status,
            'git_repository': instance.git_repository,
            'deployment_branch': instance.deployment_branch
        }
        
        updated_instance = serializer.save()
        
        # Check what changed
        changes = []
        if old_data['name'] != updated_instance.name:
            changes.append(f"name: {old_data['name']} → {updated_instance.name}")
        if old_data['description'] != updated_instance.description:
            changes.append(f"description updated")
        if old_data['website_type'] != updated_instance.website_type:
            changes.append(f"type: {old_data['website_type']} → {updated_instance.website_type}")
        if old_data['status'] != updated_instance.status:
            changes.append(f"status: {old_data['status']} → {updated_instance.status}")
        if old_data['git_repository'] != updated_instance.git_repository:
            changes.append(f"git repository updated")
        if old_data['deployment_branch'] != updated_instance.deployment_branch:
            changes.append(f"deployment branch: {old_data['deployment_branch']} → {updated_instance.deployment_branch}")
        
        if changes:
            ActivityLog.objects.create(
                user=self.request.user,
                action='website_updated',
                description=f'Updated website: {updated_instance.name} ({", ".join(changes)})',
                ip_address=self.request.META.get('REMOTE_ADDR'),
                user_agent=self.request.META.get('HTTP_USER_AGENT', ''),
                metadata={
                    'website_id': str(updated_instance.id),
                    'website_name': updated_instance.name,
                    'changes': changes,
                    'old_data': old_data
                }
            )

    @action(detail=True, methods=['post'])
    def deploy(self, request, pk=None):
        """Deploy a website"""
        website = self.get_object()
        
        # Create deployment record
        deployment = Deployment.objects.create(
            website=website,
            status='queued',
            commit_hash=request.data.get('commit_hash', ''),
            commit_message=request.data.get('commit_message', '')
        )
        
        # Here you would trigger the actual deployment process
        # For now, we'll simulate it
        deployment.status = 'building'
        deployment.save()
        
        # Log activity
        ActivityLog.objects.create(
            user=request.user,
            action='website_deployed',
            description=f'Started deployment for {website.name}',
            ip_address=request.META.get('REMOTE_ADDR'),
            user_agent=request.META.get('HTTP_USER_AGENT', ''),
            metadata={'website_id': str(website.id), 'deployment_id': str(deployment.id)}
        )
        
        return Response({
            'deployment_id': deployment.id,
            'status': deployment.status,
            'message': 'Deployment started successfully'
        })

    @action(detail=True, methods=['get'])
    def analytics(self, request, pk=None):
        """Get website analytics"""
        website = self.get_object()
        days = int(request.query_params.get('days', 30))
        
        end_date = timezone.now().date()
        start_date = end_date - timedelta(days=days)
        
        analytics = WebsiteAnalytics.objects.filter(
            website=website,
            date__range=[start_date, end_date]
        ).order_by('date')
        
        serializer = WebsiteAnalyticsSerializer(analytics, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def deployments(self, request, pk=None):
        """Get website deployment history"""
        website = self.get_object()
        deployments = website.deployments.all()[:20]  # Last 20 deployments
        serializer = DeploymentSerializer(deployments, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def backup(self, request, pk=None):
        """Create website backup"""
        website = self.get_object()
        
        backup = BackupJob.objects.create(
            user=request.user,
            website=website,
            backup_type='website',
            status='pending'
        )
        
        # Here you would trigger the actual backup process
        
        # Log activity
        ActivityLog.objects.create(
            user=request.user,
            action='backup_created',
            description=f'Created backup for {website.name}',
            ip_address=request.META.get('REMOTE_ADDR'),
            user_agent=request.META.get('HTTP_USER_AGENT', ''),
            metadata={'website_id': str(website.id), 'backup_id': str(backup.id)}
        )
        
        return Response({
            'backup_id': backup.id,
            'status': backup.status,
            'message': 'Backup job created successfully'
        })

    @action(detail=True, methods=['get'])
    def analytics(self, request, pk=None):
        """Get analytics data for a specific website"""
        website = self.get_object()
        period = request.query_params.get('period', '7d')
        
        # Parse period (e.g., '7d', '30d', '90d')
        try:
            if period.endswith('d'):
                days = int(period[:-1])
            else:
                days = 7
        except (ValueError, TypeError):
            days = 7
        
        end_date = timezone.now().date()
        start_date = end_date - timedelta(days=days)
        
        # Get analytics data for this website
        analytics_queryset = WebsiteAnalytics.objects.filter(
            website=website,
            date__range=[start_date, end_date]
        ).order_by('date')
        
        # Generate sample data if no analytics exist
        if not analytics_queryset.exists():
            analytics_data = self._generate_sample_analytics(website, start_date, end_date)
        else:
            analytics_data = []
            for analytics in analytics_queryset:
                analytics_data.append({
                    'date': analytics.date.strftime('%Y-%m-%d'),
                    'page_views': analytics.page_views,
                    'unique_visitors': analytics.unique_visitors,
                    'bounce_rate': analytics.bounce_rate,
                    'avg_session_duration': analytics.avg_session_duration,
                    'bandwidth_used': analytics.bandwidth_used
                })
        
        # Calculate totals
        total_page_views = sum(item['page_views'] for item in analytics_data)
        total_unique_visitors = sum(item['unique_visitors'] for item in analytics_data)
        avg_bounce_rate = sum(item['bounce_rate'] for item in analytics_data) / len(analytics_data) if analytics_data else 0
        avg_session_duration = sum(item['avg_session_duration'] for item in analytics_data) / len(analytics_data) if analytics_data else 0
        total_bandwidth = sum(item['bandwidth_used'] for item in analytics_data)
        
        return Response({
            'website_id': str(website.id),
            'website_name': website.name,
            'period': period,
            'start_date': start_date.strftime('%Y-%m-%d'),
            'end_date': end_date.strftime('%Y-%m-%d'),
            'summary': {
                'total_page_views': total_page_views,
                'total_unique_visitors': total_unique_visitors,
                'avg_bounce_rate': round(avg_bounce_rate, 2),
                'avg_session_duration': round(avg_session_duration, 2),
                'total_bandwidth': total_bandwidth,
            },
            'daily_data': analytics_data
        })
    
    def _generate_sample_analytics(self, website, start_date, end_date):
        """Generate sample analytics data for demonstration"""
        import random
        analytics_data = []
        current_date = start_date
        
        while current_date <= end_date:
            # Generate realistic sample data
            base_views = random.randint(50, 500)
            analytics_data.append({
                'date': current_date.strftime('%Y-%m-%d'),
                'page_views': base_views,
                'unique_visitors': random.randint(int(base_views * 0.6), int(base_views * 0.9)),
                'bounce_rate': round(random.uniform(30, 70), 2),
                'avg_session_duration': round(random.uniform(120, 600), 2),
                'bandwidth_used': random.randint(100, 1000)  # MB
            })
            current_date += timedelta(days=1)
        
        return analytics_data

    def perform_destroy(self, instance):
        """Custom destroy method - domains are kept available for reuse"""
        # Store domain reference before deletion for logging
        domain_name = instance.domain.name if instance.domain else None
        
        # Delete the website (domain remains available for reuse)
        instance.delete()
        
        # Log activity
        ActivityLog.objects.create(
            user=self.request.user,
            action='website_deleted',
            description=f'Deleted website: {instance.name}' + (f' (domain: {domain_name})' if domain_name else ''),
            ip_address=self.request.META.get('REMOTE_ADDR'),
            user_agent=self.request.META.get('HTTP_USER_AGENT', ''),
            metadata={
                'website_name': instance.name,
                'domain_name': domain_name
            }
        )


class DatabaseViewSet(viewsets.ModelViewSet):
    """
    ViewSet for user databases
    """
    serializer_class = DatabaseSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Database.objects.filter(user=self.request.user).order_by('-created_at')

    def perform_create(self, serializer):
        # Check subscription limits
        user_subscription = UserSubscription.objects.get(user=self.request.user)
        current_databases = Database.objects.filter(user=self.request.user).count()
        
        if current_databases >= user_subscription.plan.max_databases:
            raise DRFValidationError(
                f'Database limit exceeded. Upgrade your plan to create more databases.'
            )
        
        # Use provided credentials from frontend, or generate if not provided
        username = serializer.validated_data.get('username', f"db_{uuid.uuid4().hex[:8]}")
        password = serializer.validated_data.get('password', uuid.uuid4().hex)
        
        # Set port based on database type
        db_type = serializer.validated_data.get('db_type', 'mysql')
        port = 5432 if db_type == 'postgresql' else 3306
        
        # Generate unique host based on user and database name
        db_name = serializer.validated_data.get('name', 'database')
        user_id_short = str(self.request.user.id)[:8] if hasattr(self.request.user, 'id') else 'user'
        random_suffix = uuid.uuid4().hex[:4]
        host = f"{db_name}-{user_id_short}-{random_suffix}.db.ufazien.com"
        
        database = serializer.save(
            user=self.request.user,
            username=username,
            password=password,
            port=port,
            host=host
        )
        
        # Log activity
        ActivityLog.objects.create(
            user=self.request.user,
            action='database_created',
            description=f'Created database: {database.name}',
            ip_address=self.request.META.get('REMOTE_ADDR'),
            user_agent=self.request.META.get('HTTP_USER_AGENT', ''),
            metadata={'database_id': str(database.id)}
        )

    def perform_update(self, serializer):
        # Log password changes specifically
        instance = self.get_object()
        old_password = instance.password
        updated_instance = serializer.save()
        
        if 'password' in serializer.validated_data and old_password != updated_instance.password:
            ActivityLog.objects.create(
                user=self.request.user,
                action='database_password_changed',
                description=f'Changed password for database: {updated_instance.name}',
                ip_address=self.request.META.get('REMOTE_ADDR'),
                user_agent=self.request.META.get('HTTP_USER_AGENT', ''),
                metadata={'database_id': str(updated_instance.id)}
            )

    @action(detail=True, methods=['post'])
    def change_password(self, request, pk=None):
        """Change database password"""
        database = self.get_object()
        new_password = request.data.get('password')
        
        if not new_password:
            return Response(
                {'error': 'Password is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if len(new_password) < 8:
            return Response(
                {'error': 'Password must be at least 8 characters long'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        database.password = new_password
        database.save()
        
        # Log activity
        ActivityLog.objects.create(
            user=request.user,
            action='database_password_changed',
            description=f'Changed password for database: {database.name}',
            ip_address=request.META.get('REMOTE_ADDR'),
            user_agent=request.META.get('HTTP_USER_AGENT', ''),
            metadata={'database_id': str(database.id)}
        )
        
        return Response({'message': 'Password updated successfully'})

    @action(detail=True, methods=['post'])
    def backup(self, request, pk=None):
        """Create database backup"""
        database = self.get_object()
        
        backup = BackupJob.objects.create(
            user=request.user,
            database=database,
            backup_type='database',
            status='pending'
        )
        
        # Here you would trigger the actual backup process
        
        return Response({
            'backup_id': backup.id,
            'status': backup.status,
            'message': 'Database backup job created successfully'
        })

    def perform_destroy(self, instance):
        """Custom destroy method with logging"""
        database_name = instance.name
        database_id = str(instance.id)
        database_type = instance.db_type
        
        # Check if database is being used by any websites
        websites_using_database = Website.objects.filter(database=instance)
        website_names = [website.name for website in websites_using_database]
        
        # Delete the database
        instance.delete()
        
        # Log database deletion activity
        ActivityLog.objects.create(
            user=self.request.user,
            action='database_deleted',
            description=f'Deleted {database_type} database: {database_name}' + (f' (used by websites: {", ".join(website_names)})' if website_names else ''),
            ip_address=self.request.META.get('REMOTE_ADDR'),
            user_agent=self.request.META.get('HTTP_USER_AGENT', ''),
            metadata={
                'database_id': database_id,
                'database_name': database_name,
                'database_type': database_type,
                'websites_affected': website_names
            }
        )


class DomainViewSet(viewsets.ModelViewSet):
    """
    ViewSet for user domains
    """
    serializer_class = DomainSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Domain.objects.filter(user=self.request.user).order_by('-created_at')

    def perform_create(self, serializer):
        domain = serializer.save(user=self.request.user)
        
        # Automatically create SSL certificate for the new domain
        try:
            # Check if SSL certificate already exists (shouldn't happen due to OneToOne relationship)
            if not hasattr(domain, 'ssl_certificate'):
                ssl_certificate = SSLCertificate.objects.create(
                    domain=domain,
                    status='pending',
                    issuer='Let\'s Encrypt',
                    auto_renew=True
                )
                
                # Simulate SSL certificate processing
                ssl_certificate.issued_at = timezone.now()
                ssl_certificate.expires_at = timezone.now() + timedelta(days=90)  # Let's Encrypt 90-day validity
                ssl_certificate.status = 'active'
                ssl_certificate.save()
                
                # Update domain SSL status
                domain.ssl_enabled = True
                domain.ssl_expires_at = ssl_certificate.expires_at
                domain.save()
                
                # Log SSL certificate creation
                ActivityLog.objects.create(
                    user=self.request.user,
                    action='ssl_issued',
                    description=f'Automatically issued SSL certificate for domain: {domain.name}',
                    ip_address=self.request.META.get('REMOTE_ADDR'),
                    user_agent=self.request.META.get('HTTP_USER_AGENT', ''),
                    metadata={
                        'domain_id': str(domain.id),
                        'ssl_certificate_id': str(ssl_certificate.id),
                        'auto_created': True
                    }
                )
        except Exception as e:
            # Log error but don't fail domain creation
            ActivityLog.objects.create(
                user=self.request.user,
                action='ssl_issue_failed',
                description=f'Failed to automatically create SSL certificate for domain: {domain.name}. Error: {str(e)}',
                ip_address=self.request.META.get('REMOTE_ADDR'),
                user_agent=self.request.META.get('HTTP_USER_AGENT', ''),
                metadata={
                    'domain_id': str(domain.id),
                    'error': str(e)
                }
            )
        
        # Log domain creation activity
        ActivityLog.objects.create(
            user=self.request.user,
            action='domain_added',
            description=f'Added domain: {domain.name}',
            ip_address=self.request.META.get('REMOTE_ADDR'),
            user_agent=self.request.META.get('HTTP_USER_AGENT', ''),
            metadata={'domain_id': str(domain.id)}
        )

    def perform_destroy(self, instance):
        """Custom destroy method with logging"""
        domain_name = instance.name
        domain_id = str(instance.id)
        ssl_certificate_id = None
        
        # Check if there's an SSL certificate that will be deleted too
        try:
            ssl_cert = instance.ssl_certificate
            ssl_certificate_id = str(ssl_cert.id)
        except SSLCertificate.DoesNotExist:
            pass
        
        # Check if domain is being used by any websites
        websites_using_domain = Website.objects.filter(domain=instance)
        website_names = [website.name for website in websites_using_domain]
        
        # Delete the domain (this will cascade delete the SSL certificate due to OneToOne relationship)
        instance.delete()
        
        # Log domain deletion activity
        ActivityLog.objects.create(
            user=self.request.user,
            action='domain_deleted',
            description=f'Deleted domain: {domain_name}' + (f' (used by websites: {", ".join(website_names)})' if website_names else ''),
            ip_address=self.request.META.get('REMOTE_ADDR'),
            user_agent=self.request.META.get('HTTP_USER_AGENT', ''),
            metadata={
                'domain_id': domain_id,
                'domain_name': domain_name,
                'ssl_certificate_id': ssl_certificate_id,
                'websites_affected': website_names
            }
        )
        
        # If there was an SSL certificate, log its deletion too
        if ssl_certificate_id:
            ActivityLog.objects.create(
                user=self.request.user,
                action='ssl_deleted',
                description=f'SSL certificate automatically deleted with domain: {domain_name}',
                ip_address=self.request.META.get('REMOTE_ADDR'),
                user_agent=self.request.META.get('HTTP_USER_AGENT', ''),
                metadata={
                    'domain_id': domain_id,
                    'domain_name': domain_name,
                    'ssl_certificate_id': ssl_certificate_id,
                    'auto_deleted_with_domain': True
                }
            )

    def perform_update(self, serializer):
        """Log domain updates"""
        instance = self.get_object()
        old_data = {
            'name': instance.name,
            'domain_type': instance.domain_type,
            'status': instance.status
        }
        
        updated_instance = serializer.save()
        
        # Check what changed
        changes = []
        if old_data['name'] != updated_instance.name:
            changes.append(f"name: {old_data['name']} → {updated_instance.name}")
        if old_data['domain_type'] != updated_instance.domain_type:
            changes.append(f"type: {old_data['domain_type']} → {updated_instance.domain_type}")
        if old_data['status'] != updated_instance.status:
            changes.append(f"status: {old_data['status']} → {updated_instance.status}")
        
        if changes:
            ActivityLog.objects.create(
                user=self.request.user,
                action='domain_updated',
                description=f'Updated domain: {updated_instance.name} ({", ".join(changes)})',
                ip_address=self.request.META.get('REMOTE_ADDR'),
                user_agent=self.request.META.get('HTTP_USER_AGENT', ''),
                metadata={
                    'domain_id': str(updated_instance.id),
                    'domain_name': updated_instance.name,
                    'changes': changes,
                    'old_data': old_data
                }
            )

    @action(detail=False, methods=['get'])
    def available(self, request):
        """Get available domains (not used by any website)"""
        used_domain_ids = Website.objects.filter(
            user=request.user
        ).exclude(domain=None).values_list('domain_id', flat=True)
        
        available_domains = Domain.objects.filter(
            user=request.user
        ).exclude(id__in=used_domain_ids)
        
        serializer = self.get_serializer(available_domains, many=True)
        return Response(serializer.data)


class SSLCertificateViewSet(viewsets.ModelViewSet):
    """
    ViewSet for SSL certificates
    """
    serializer_class = SSLCertificateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return SSLCertificate.objects.filter(domain__user=self.request.user)

    def destroy(self, request, *args, **kwargs):
        """Delete SSL certificate with logging and validation"""
        certificate = self.get_object()
        domain_name = certificate.domain.name
        
        # Check if this is an active certificate for a live website
        if certificate.status == 'active':
            # You might want to add additional checks here
            # For example, check if there are active websites using this domain
            pass
        
        # Log the deletion
        ActivityLog.objects.create(
            user=request.user,
            action='ssl_deleted',
            description=f'Deleted SSL certificate for {domain_name}',
            ip_address=request.META.get('REMOTE_ADDR'),
            user_agent=request.META.get('HTTP_USER_AGENT', ''),
            metadata={'certificate_id': str(certificate.id), 'domain_name': domain_name}
        )
        
        return super().destroy(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        """Create SSL certificate with logging"""
        response = super().create(request, *args, **kwargs)
        
        if response.status_code == 201:
            certificate_data = response.data
            domain_name = request.data.get('domain', 'Unknown')
            
            # Log the creation
            ActivityLog.objects.create(
                user=request.user,
                action='ssl_created',
                description=f'Created SSL certificate for {domain_name}',
                ip_address=request.META.get('REMOTE_ADDR'),
                user_agent=request.META.get('HTTP_USER_AGENT', ''),
                metadata={'certificate_id': str(certificate_data.get('id')), 'domain_name': domain_name}
            )
        
        return response

    def perform_update(self, serializer):
        """Log SSL certificate updates"""
        instance = self.get_object()
        old_data = {
            'status': instance.status,
            'auto_renew': instance.auto_renew,
            'issuer': instance.issuer
        }
        
        updated_instance = serializer.save()
        
        # Check what changed
        changes = []
        if old_data['status'] != updated_instance.status:
            changes.append(f"status: {old_data['status']} → {updated_instance.status}")
        if old_data['auto_renew'] != updated_instance.auto_renew:
            changes.append(f"auto_renew: {old_data['auto_renew']} → {updated_instance.auto_renew}")
        if old_data['issuer'] != updated_instance.issuer:
            changes.append(f"issuer: {old_data['issuer']} → {updated_instance.issuer}")
        
        if changes:
            ActivityLog.objects.create(
                user=self.request.user,
                action='ssl_updated',
                description=f'Updated SSL certificate for {updated_instance.domain.name} ({", ".join(changes)})',
                ip_address=self.request.META.get('REMOTE_ADDR'),
                user_agent=self.request.META.get('HTTP_USER_AGENT', ''),
                metadata={
                    'certificate_id': str(updated_instance.id),
                    'domain_name': updated_instance.domain.name,
                    'changes': changes,
                    'old_data': old_data
                }
            )

    @action(detail=True, methods=['post'])
    def renew(self, request, pk=None):
        """Renew SSL certificate"""
        certificate = self.get_object()
        
        # Here you would trigger the SSL renewal process
        certificate.status = 'pending'
        certificate.save()
        
        # Log activity
        ActivityLog.objects.create(
            user=request.user,
            action='ssl_issued',
            description=f'Renewed SSL certificate for {certificate.domain.name}',
            ip_address=request.META.get('REMOTE_ADDR'),
            user_agent=request.META.get('HTTP_USER_AGENT', ''),
            metadata={'certificate_id': str(certificate.id)}
        )
        
        return Response({
            'message': 'SSL certificate renewal initiated',
            'status': certificate.status
        })


class BackupJobViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for backup jobs - read only for users to see their backups
    """
    serializer_class = BackupJobSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return BackupJob.objects.filter(user=self.request.user).order_by('-created_at')

    @action(detail=True, methods=['post'])
    def restore(self, request, pk=None):
        """Restore from backup"""
        backup = self.get_object()
        
        if backup.status != 'completed':
            return Response(
                {'error': 'Can only restore from completed backups'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Here you would trigger the restore process
        
        # Log activity
        ActivityLog.objects.create(
            user=request.user,
            action='backup_restored',
            description=f'Restored from backup {backup.id}',
            ip_address=request.META.get('REMOTE_ADDR'),
            user_agent=request.META.get('HTTP_USER_AGENT', ''),
            metadata={'backup_id': str(backup.id)}
        )
        
        return Response({'message': 'Restore process initiated'})


class InvoiceViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for user invoices - read only
    """
    serializer_class = InvoiceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Invoice.objects.filter(user=self.request.user).order_by('-created_at')


class ActivityLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for user activity logs - read only
    """
    serializer_class = ActivityLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return ActivityLog.objects.filter(user=self.request.user).order_by('-created_at')


class DeploymentViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for deployments - read only
    """
    serializer_class = DeploymentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = Deployment.objects.filter(website__user=self.request.user).order_by('-started_at')
        
        # Filter by website if specified
        website_id = self.request.query_params.get('website', None)
        if website_id is not None:
            queryset = queryset.filter(website__id=website_id)
            
        # Filter by status if specified
        status = self.request.query_params.get('status', None)
        if status is not None:
            queryset = queryset.filter(status=status)
            
        return queryset


class DashboardAPIView(APIView):
    """
    API view for dashboard statistics
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        
        # Get user subscription
        try:
            subscription = UserSubscription.objects.get(user=user)
            usage_stats = subscription.get_usage_stats()
        except UserSubscription.DoesNotExist:
            # Create default free subscription
            free_plan = SubscriptionPlan.objects.get(name='free')
            subscription = UserSubscription.objects.create(user=user, plan=free_plan)
            usage_stats = subscription.get_usage_stats()
        
        # Get recent activity
        recent_activity = ActivityLog.objects.filter(user=user)[:10]
        
        # Get website statistics
        websites = Website.objects.filter(user=user)
        active_websites = websites.filter(status='active').count()
        total_visits = websites.aggregate(total=Sum('total_visits'))['total'] or 0
        
        # Get recent deployments
        recent_deployments = Deployment.objects.filter(
            website__user=user
        ).order_by('-started_at')[:5]
        
        # Calculate bandwidth usage for current month
        current_month = timezone.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        bandwidth_usage = BandwidthUsage.objects.filter(
            website__user=user,
            date__gte=current_month
        ).aggregate(total=Sum('bandwidth_mb'))['total'] or 0
        
        return Response({
            'subscription': {
                'plan': subscription.plan.display_name,
                'price': subscription.plan.price,
                'limits': {
                    'websites': subscription.plan.max_websites,
                    'databases': subscription.plan.max_databases,
                    'storage_mb': subscription.plan.storage_limit_mb,
                    'bandwidth_mb': subscription.plan.bandwidth_limit_mb,
                }
            },
            'usage': usage_stats,
            'stats': {
                'total_websites': websites.count(),
                'active_websites': active_websites,
                'total_visits': total_visits,
                'bandwidth_used_mb': bandwidth_usage,
            },
            'recent_activity': ActivityLogSerializer(recent_activity, many=True).data,
            'recent_deployments': DeploymentSerializer(recent_deployments, many=True).data,
        })


class AnalyticsAPIView(APIView):
    """
    API view for analytics data
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        days = int(request.query_params.get('days', 30))
        website_id = request.query_params.get('website_id')
        
        end_date = timezone.now().date()
        start_date = end_date - timedelta(days=days)
        
        queryset = WebsiteAnalytics.objects.filter(
            website__user=request.user,
            date__range=[start_date, end_date]
        )
        
        if website_id:
            queryset = queryset.filter(website_id=website_id)
        
        # Aggregate data by date
        analytics_data = {}
        for analytics in queryset:
            date_str = analytics.date.strftime('%Y-%m-%d')
            if date_str not in analytics_data:
                analytics_data[date_str] = {
                    'page_views': 0,
                    'unique_visitors': 0,
                    'bounce_rate': 0,
                    'avg_session_duration': 0,
                    'count': 0
                }
            
            analytics_data[date_str]['page_views'] += analytics.page_views
            analytics_data[date_str]['unique_visitors'] += analytics.unique_visitors
            analytics_data[date_str]['bounce_rate'] += analytics.bounce_rate
            analytics_data[date_str]['avg_session_duration'] += analytics.avg_session_duration
            analytics_data[date_str]['count'] += 1
        
        # Calculate averages
        for date_data in analytics_data.values():
            if date_data['count'] > 0:
                date_data['bounce_rate'] /= date_data['count']
                date_data['avg_session_duration'] /= date_data['count']
            del date_data['count']
        
        return Response({
            'analytics': analytics_data,
            'summary': {
                'total_page_views': sum(d['page_views'] for d in analytics_data.values()),
                'total_unique_visitors': sum(d['unique_visitors'] for d in analytics_data.values()),
                'avg_bounce_rate': sum(d['bounce_rate'] for d in analytics_data.values()) / len(analytics_data) if analytics_data else 0,
                'avg_session_duration': sum(d['avg_session_duration'] for d in analytics_data.values()) / len(analytics_data) if analytics_data else 0,
            }
        })


class BandwidthAnalyticsAPIView(APIView):
    """
    API view for bandwidth analytics data
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        period = request.query_params.get('period', '30d')
        website_id = request.query_params.get('website_id')
        
        # Parse period (e.g., '7d', '30d', '90d')
        if period.endswith('d'):
            days = int(period[:-1])
        else:
            days = 30
        
        end_date = timezone.now().date()
        start_date = end_date - timedelta(days=days)
        
        # Get bandwidth usage data
        queryset = BandwidthUsage.objects.filter(
            website__user=request.user,
            date__range=[start_date, end_date]
        )
        
        if website_id:
            queryset = queryset.filter(website_id=website_id)
        
        # Aggregate data
        total_bandwidth = sum(usage.bandwidth_mb for usage in queryset)
        
        # Get user's subscription for limits
        try:
            user_subscription = UserSubscription.objects.get(user=request.user, status='active')
            bandwidth_limit = user_subscription.plan.bandwidth_limit_mb
        except UserSubscription.DoesNotExist:
            bandwidth_limit = 1000  # Default limit
        
        # Group by date for chart data
        daily_usage = {}
        for usage in queryset:
            date_str = usage.date.strftime('%Y-%m-%d')
            if date_str not in daily_usage:
                daily_usage[date_str] = 0
            daily_usage[date_str] += usage.bandwidth_mb
        
        # Convert to list format for frontend
        chart_data = [
            {'date': date, 'bandwidth_mb': mb}
            for date, mb in sorted(daily_usage.items())
        ]
        
        return Response({
            'total_bandwidth_mb': total_bandwidth,
            'bandwidth_limit_mb': bandwidth_limit,
            'percentage_used': (total_bandwidth / bandwidth_limit * 100) if bandwidth_limit > 0 else 0,
            'daily_usage': chart_data,
            'period': period,
            'start_date': start_date,
            'end_date': end_date
        })


# Legacy function-based views for specific endpoints
@csrf_exempt
@require_http_methods(["POST"])
@login_required
def webhook_deployment_status(request):
    """
    Webhook endpoint for deployment status updates
    """
    try:
        data = json.loads(request.body)
        deployment_id = data.get('deployment_id')
        status = data.get('status')
        log_data = data.get('log', '')
        
        deployment = Deployment.objects.get(id=deployment_id)
        deployment.status = status
        deployment.build_log = log_data
        
        if status in ['success', 'failed']:
            deployment.completed_at = timezone.now()
        
        deployment.save()
        
        # Update website status
        if status == 'success':
            deployment.website.status = 'active'
            deployment.website.last_deployment = timezone.now()
            deployment.website.save()
        elif status == 'failed':
            deployment.website.status = 'error'
            deployment.website.save()
        
        return JsonResponse({'status': 'ok'})
    
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)


@csrf_exempt  
@require_http_methods(["POST"])
def webhook_analytics(request):
    """
    Webhook endpoint for analytics data
    """
    try:
        data = json.loads(request.body)
        website_id = data.get('website_id')
        date = datetime.strptime(data.get('date'), '%Y-%m-%d').date()
        
        analytics, created = WebsiteAnalytics.objects.get_or_create(
            website_id=website_id,
            date=date,
            defaults={
                'page_views': data.get('page_views', 0),
                'unique_visitors': data.get('unique_visitors', 0),
                'bounce_rate': data.get('bounce_rate', 0.0),
                'avg_session_duration': data.get('avg_session_duration', 0),
                'top_pages': data.get('top_pages', []),
                'referrers': data.get('referrers', []),
            }
        )
        
        if not created:
            analytics.page_views += data.get('page_views', 0)
            analytics.unique_visitors += data.get('unique_visitors', 0)
            analytics.save()
        
        return JsonResponse({'status': 'ok'})
    
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def create_sample_logs(request):
    """
    Create sample logs for testing (development only)
    """
    user = request.user
    
    # Create sample activity logs
    sample_activities = [
        {
            'action': 'website_created',
            'description': 'Created new website "My Portfolio"',
            'metadata': {'website_name': 'My Portfolio', 'website_type': 'static'}
        },
        {
            'action': 'website_deployed',
            'description': 'Successfully deployed website "My Portfolio"',
            'metadata': {'website_name': 'My Portfolio', 'deployment_time': '2.3 seconds'}
        },
        {
            'action': 'database_created',
            'description': 'Created MySQL database "portfolio_db"',
            'metadata': {'database_name': 'portfolio_db', 'database_type': 'mysql'}
        },
        {
            'action': 'ssl_issued',
            'description': 'SSL certificate issued for portfolio.ufazien.com',
            'metadata': {'domain_name': 'portfolio.ufazien.com', 'issuer': 'Let\'s Encrypt'}
        },
    ]
    
    created_logs = []
    for activity in sample_activities:
        log = ActivityLog.objects.create(
            user=user,
            action=activity['action'],
            description=activity['description'],
            metadata=activity['metadata']
        )
        created_logs.append(ActivityLogSerializer(log).data)
    
    return JsonResponse({
        'status': 'success',
        'created_logs': len(created_logs),
        'logs': created_logs
    })
