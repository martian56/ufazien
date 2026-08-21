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
from rest_framework import viewsets, status, permissions, generics, filters
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.pagination import PageNumberPagination
from datetime import datetime, timedelta
import hashlib
import hmac
import json
import uuid

from django.conf import settings

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
from .tasks import provision_database, compute_storage_for_user


# Standard pagination for hosting endpoints
class StandardResultsSetPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


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
        website.last_deployment = timezone.now()
        website.save()

        # Log activity
        ActivityLog.objects.create(
            user=self.request.user,
            action='website_created',
            description=f'Created website: {website.name}',
            ip_address=self.request.META.get('REMOTE_ADDR'),
            user_agent=self.request.META.get('HTTP_USER_AGENT', ''),
            metadata={'website_id': str(website.id)}
        )
        
        compute_storage_for_user.delay(self.request.user.id)

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
        updated_instance.last_deployment = timezone.now()
        updated_instance.save()

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
        compute_storage_for_user.delay(self.request.user.id)

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
        deployment.status = 'success'
        deployment.save()

        website.last_deployment = timezone.now()
        website.save()

        # Log activity
        ActivityLog.objects.create(
            user=request.user,
            action='website_deployed',
            description=f'Started deployment for {website.name}',
            ip_address=request.META.get('REMOTE_ADDR'),
            user_agent=request.META.get('HTTP_USER_AGENT', ''),
            metadata={'website_id': str(website.id), 'deployment_id': str(deployment.id)}
        )
        compute_storage_for_user.delay(self.request.user.id)
        
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
        
        # A site with no traffic yet has no traffic yet. This used to invent a
        # week of it with `random.randint` whenever the table was empty — which
        # it always was, because nothing wrote to it — so nobody has ever seen
        # their own numbers on this page.
        analytics_data = [
            {
                'date': analytics.date.strftime('%Y-%m-%d'),
                'page_views': analytics.page_views,
                'unique_visitors': analytics.unique_visitors,
                'bounce_rate': analytics.bounce_rate,
                'avg_session_duration': analytics.avg_session_duration,
                'bandwidth_used': analytics.bandwidth_used,
            }
            for analytics in analytics_queryset
        ]
        
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
    
    def perform_destroy(self, instance):
        """Custom destroy method - domains are kept available for reuse"""
        import os
        import shutil
        
        # Store domain reference before deletion for logging
        domain_name = instance.domain.name if instance.domain else None
        website_name = instance.name
        
        # Get subdomain to determine folder path
        if instance.domain and instance.domain.name:
            subdomain = instance.domain.name.split('.')[0]
        else:
            subdomain = instance.name
        
        # Delete the website folder if it exists
        website_dir = f"/srv/hosting/{subdomain}"
        if os.path.exists(website_dir):
            try:
                shutil.rmtree(website_dir)
            except Exception as e:
                # Log error but don't prevent deletion
                ActivityLog.objects.create(
                    user=self.request.user,
                    action='website_folder_deletion_failed',
                    description=f'Failed to delete website folder for {website_name}: {str(e)}',
                    ip_address=self.request.META.get('REMOTE_ADDR'),
                    user_agent=self.request.META.get('HTTP_USER_AGENT', ''),
                    metadata={
                        'website_name': website_name,
                        'folder_path': website_dir,
                        'error': str(e)
                    }
                )
        
        # Delete the website (domain remains available for reuse)
        instance.delete()
        
        # Log activity
        ActivityLog.objects.create(
            user=self.request.user,
            action='website_deleted',
            description=f'Deleted website: {website_name}' + (f' (domain: {domain_name})' if domain_name else ''),
            ip_address=self.request.META.get('REMOTE_ADDR'),
            user_agent=self.request.META.get('HTTP_USER_AGENT', ''),
            metadata={
                'website_name': website_name,
                'domain_name': domain_name
            }
        )
        compute_storage_for_user.delay(self.request.user.id)

    @action(detail=True, methods=['post'])
    def upload_files(self, request, pk=None):
        """Upload files to website directory"""
        import os
        import shutil
        
        website = self.get_object()
        
        # Get subdomain from website domain
        if not website.domain:
            return Response({'error': 'Website has no domain'}, status=400)
        
        subdomain = website.domain.name.split('.')[0]  # Extract subdomain
        website_dir = f"/srv/hosting/{subdomain}"
        
        # Create directory if it doesn't exist
        os.makedirs(website_dir, exist_ok=True)
        
        # Process uploaded files
        uploaded_files = request.FILES.getlist('files')
        saved_files = []
        
        for file in uploaded_files:
            print(f"Upload debug: Processing file '{file.name}' (size: {file.size} bytes)")
            
            # Handle folder uploads - file.name includes relative path
            if '/' in file.name:
                # This is a file from a folder upload
                file_path = os.path.join(website_dir, file.name)
                # Create directory structure if it doesn't exist
                file_dir = os.path.dirname(file_path)
                os.makedirs(file_dir, exist_ok=True)
                print(f"Upload debug: Created directory structure for '{file.name}' -> '{file_path}'")
            else:
                # Regular file upload
                file_path = os.path.join(website_dir, file.name)
                print(f"Upload debug: Regular file upload '{file.name}' -> '{file_path}'")
            
            # Save file to disk
            with open(file_path, 'wb+') as destination:
                for chunk in file.chunks():
                    destination.write(chunk)
            
            saved_files.append(file.name)
        self.write_env_file_from_dict(website.environment_variables or {}, website_dir)

        website.status = 'active'
        website.save()

        compute_storage_for_user.delay(self.request.user.id)
        
        return Response({
            'message': f'Uploaded {len(saved_files)} files',
            'files': saved_files,
            'website_url': f'http://{website.domain.name}'
        })

    @action(detail=True, methods=['post'])  
    def upload_zip(self, request, pk=None):
        """Upload and extract ZIP file to website directory"""
        import os
        import zipfile
        import tempfile
        import shutil
        
        website = self.get_object()
        
        if not website.domain:
            return Response({'error': 'Website has no domain'}, status=400)
        
        subdomain = website.domain.name.split('.')[0]
        website_dir = f"/srv/hosting/{subdomain}"
        
        # Create website directory if it doesn't exist
        os.makedirs(website_dir, exist_ok=True)
        
        # Get uploaded ZIP file
        zip_file = request.FILES.get('zip_file')
        if not zip_file:
            print(f"ZIP upload debug: Available files in request: {list(request.FILES.keys())}")
            return Response({'error': 'No ZIP file provided'}, status=400)
        
        print(f"ZIP upload debug: Received file '{zip_file.name}' with size {zip_file.size} bytes")
        
        # Extract ZIP to website directory
        try:
            # Preserve .env file if it exists (contains database credentials)
            env_file_path = os.path.join(website_dir, '.env')
            env_content = None
            if os.path.exists(env_file_path):
                with open(env_file_path, 'r') as f:
                    env_content = f.read()
                print("ZIP upload debug: Preserved .env file")
            
            # Clear existing files in website directory (except .env which we'll restore)
            if os.path.exists(website_dir):
                for item in os.listdir(website_dir):
                    item_path = os.path.join(website_dir, item)
                    try:
                        if os.path.isdir(item_path):
                            shutil.rmtree(item_path)
                        else:
                            # Skip .env file - we'll restore it later
                            if item != '.env':
                                os.remove(item_path)
                    except Exception as e:
                        print(f"ZIP upload debug: Warning - could not delete {item_path}: {e}")
            
            with tempfile.TemporaryDirectory() as temp_dir:
                zip_path = os.path.join(temp_dir, 'upload.zip')
                extract_dir = os.path.join(temp_dir, 'extracted')
                
                # Save ZIP file temporarily
                with open(zip_path, 'wb+') as destination:
                    for chunk in zip_file.chunks():
                        destination.write(chunk)
                
                # Extract ZIP file to temporary directory
                with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                    zip_ref.extractall(extract_dir)
                
                # Move contents from extracted directory to website directory
                # If there's only one folder in the extracted directory, move its contents
                extracted_items = os.listdir(extract_dir)
                if len(extracted_items) == 1 and os.path.isdir(os.path.join(extract_dir, extracted_items[0])):
                    # Single folder - move its contents
                    source_dir = os.path.join(extract_dir, extracted_items[0])
                    for item in os.listdir(source_dir):
                        source_path = os.path.join(source_dir, item)
                        dest_path = os.path.join(website_dir, item)
                        if os.path.isdir(source_path):
                            shutil.copytree(source_path, dest_path, dirs_exist_ok=True)
                        else:
                            shutil.copy2(source_path, dest_path)
                else:
                    # Multiple items or files - move them directly
                    for item in extracted_items:
                        source_path = os.path.join(extract_dir, item)
                        dest_path = os.path.join(website_dir, item)
                        if os.path.isdir(source_path):
                            shutil.copytree(source_path, dest_path, dirs_exist_ok=True)
                        else:
                            shutil.copy2(source_path, dest_path)
                
                # Restore .env file if it was preserved (only if not in the new ZIP)
                if env_content is not None:
                    new_env_path = os.path.join(website_dir, '.env')
                    # Only restore if .env wasn't included in the new deployment
                    if not os.path.exists(new_env_path):
                        with open(new_env_path, 'w') as f:
                            f.write(env_content)
                        print("ZIP upload debug: Restored preserved .env file")
                
                website.status = 'active'
                website.save()
                    
            self.write_env_file_from_dict(website.environment_variables or {}, website_dir)

            compute_storage_for_user.delay(self.request.user.id)

            return Response({
                'message': 'ZIP file extracted successfully',
                'website_url': f'http://{website.domain.name}'
            })
            
        except Exception as e:
            import traceback
            error_details = traceback.format_exc()
            print(f"ZIP upload error: {str(e)}")
            print(f"Traceback: {error_details}")
            return Response({'error': f'Failed to extract ZIP: {str(e)}'}, status=400)
    @action(detail=True, methods=['get'])
    def list_files(self, request, pk=None):
        """List files and folders in the website directory"""
        import os
        import datetime

        website = self.get_object()
        if not website.domain:
            return Response({'error': 'Website has no domain'}, status=400)

        subdomain = website.domain.name.split('.')[0]
        website_dir = f"/srv/hosting/{subdomain}"

        if not os.path.exists(website_dir):
            return Response({'files': [], 'folders': []})

        files = []
        folders = []
        
        for item_name in os.listdir(website_dir):
            item_path = os.path.join(website_dir, item_name)
            
            if os.path.isfile(item_path):
                statinfo = os.stat(item_path)
                try:
                    modified = timezone.make_aware(datetime.datetime.fromtimestamp(statinfo.st_mtime)).isoformat()
                except Exception:
                    modified = None
                files.append({
                    'name': item_name,
                    'size': statinfo.st_size,
                    'modified': modified,
                    'type': 'file'
                })
            elif os.path.isdir(item_path):
                statinfo = os.stat(item_path)
                try:
                    modified = timezone.make_aware(datetime.datetime.fromtimestamp(statinfo.st_mtime)).isoformat()
                    # Count files in folder
                    file_count = len([f for f in os.listdir(item_path) if os.path.isfile(os.path.join(item_path, f))])
                except Exception:
                    modified = None
                    file_count = 0
                folders.append({
                    'name': item_name,
                    'modified': modified,
                    'type': 'folder',
                    'file_count': file_count
                })

        return Response({'files': files, 'folders': folders})

    @action(detail=True, methods=['post'])
    def delete_file(self, request, pk=None):
        """Delete a file or folder from the website directory"""
        import os
        import shutil

        website = self.get_object()
        if not website.domain:
            return Response({'error': 'Website has no domain'}, status=400)

        filename = request.data.get('filename')
        if not filename:
            return Response({'error': 'filename is required'}, status=400)

        subdomain = website.domain.name.split('.')[0]
        website_dir = f"/srv/hosting/{subdomain}"
        file_path = os.path.normpath(os.path.join(website_dir, filename))

        # Prevent path traversal
        if not file_path.startswith(os.path.abspath(website_dir)):
            return Response({'error': 'invalid filename'}, status=400)

        if os.path.exists(file_path):
            try:
                if os.path.isfile(file_path):
                    os.remove(file_path)
                    return Response({'message': 'File deleted'})
                elif os.path.isdir(file_path):
                    shutil.rmtree(file_path)
                    return Response({'message': 'Folder deleted'})
            except Exception as e:
                return Response({'error': str(e)}, status=400)
        compute_storage_for_user.delay(self.request.user.id)

        return Response({'error': 'file not found'}, status=404)

    @action(detail=True, methods=['get'])
    def download_file(self, request, pk=None):
        """Download a specific file or folder from the website directory"""
        import os
        import zipfile
        import tempfile
        from django.http import FileResponse

        website = self.get_object()
        if not website.domain:
            return Response({'error': 'Website has no domain'}, status=400)

        filename = request.query_params.get('filename')
        if not filename:
            return Response({'error': 'filename is required'}, status=400)

        subdomain = website.domain.name.split('.')[0]
        website_dir = f"/srv/hosting/{subdomain}"
        file_path = os.path.normpath(os.path.join(website_dir, filename))

        # Prevent path traversal
        if not file_path.startswith(os.path.abspath(website_dir)):
            return Response({'error': 'invalid filename'}, status=400)

        if os.path.exists(file_path):
            try:
                if os.path.isfile(file_path):
                    return FileResponse(open(file_path, 'rb'), as_attachment=True, filename=os.path.basename(file_path))
                elif os.path.isdir(file_path):
                    # Create a ZIP file for folders
                    temp_zip = tempfile.NamedTemporaryFile(delete=False, suffix='.zip')
                    with zipfile.ZipFile(temp_zip.name, 'w', zipfile.ZIP_DEFLATED) as zipf:
                        for root, dirs, files in os.walk(file_path):
                            for file in files:
                                file_path_full = os.path.join(root, file)
                                # Calculate relative path from the folder being zipped
                                arcname = os.path.relpath(file_path_full, file_path)
                                zipf.write(file_path_full, arcname)
                    
                    return FileResponse(open(temp_zip.name, 'rb'), as_attachment=True, filename=f"{os.path.basename(file_path)}.zip")
            except Exception as e:
                return Response({'error': str(e)}, status=400)

        return Response({'error': 'file not found'}, status=404)

    def write_env_file_from_dict(self, env_dict, target_dir):
        """
        env_dict: dict of {KEY: value}
        target_dir: directory where .env will be created (string)
        """
        import os
        if not env_dict:
            return

        tmp_path = os.path.join(target_dir, ".env.tmp")
        final_path = os.path.join(target_dir, ".env")

        lines = []
        for key, val in env_dict.items():
            if val is None:
                continue
            s = str(val)
            lines.append(f"{key}={s}")

        # write atomically
        with open(tmp_path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines) + "\n")
        os.replace(tmp_path, final_path)


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
        
        # Use provided credentials from frontend, or leave blank to generate in task
        username = serializer.validated_data.get('username', '')
        password = serializer.validated_data.get('password', '')

        # Set port based on database type (postgres uses 5433 per request)
        db_type = serializer.validated_data.get('db_type', 'mysql')
        port = 5433 if db_type == 'postgresql' else 3306

        # host name is mysql.ufazien.com or postgres.ufazien.com
        host = "mysql.ufazien.com" if db_type == 'mysql' else "postgres.ufazien.com"

        # Create DB record in 'creating' state and enqueue provisioning
        database = serializer.save(
            user=self.request.user,
            username=username,
            password=password,
            port=port,
            host=host,
            status='creating',
            error_message='',
            connection_info={}
        )

        # Log provisioning start
        ActivityLog.objects.create(
            user=self.request.user,
            action='database_provisioning_started',
            description=f'Started provisioning database: {database.name}',
            ip_address=self.request.META.get('REMOTE_ADDR'),
            user_agent=self.request.META.get('HTTP_USER_AGENT', ''),
            metadata={'database_id': str(database.id)}
        )

        # Enqueue background task to provision the database
        provision_database.delay(str(database.id))
        compute_storage_for_user.delay(self.request.user.id)

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
        # If database is in use, prevent deletion
        if website_names:
            raise DRFValidationError(f'Cannot delete database; it is used by websites: {", ".join(website_names)}')

        # Mark as deleting and enqueue remote deletion task
        instance.status = 'deleting'
        instance.save()

        ActivityLog.objects.create(
            user=self.request.user,
            action='database_deletion_scheduled',
            description=f'Scheduled deletion for {database_type} database: {database_name}',
            ip_address=self.request.META.get('REMOTE_ADDR'),
            user_agent=self.request.META.get('HTTP_USER_AGENT', ''),
            metadata={
                'database_id': database_id,
                'database_name': database_name,
                'database_type': database_type
            }
        )

        # Enqueue background task to delete remote DB and then local record
        from .tasks import delete_provisioned_database
        delete_provisioned_database.delay(str(instance.id))
        compute_storage_for_user.delay(self.request.user.id)


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
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        return ActivityLog.objects.filter(user=self.request.user).order_by('-created_at')


class DeploymentViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for deployments - read only
    """
    serializer_class = DeploymentSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = StandardResultsSetPagination

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


class PublicWebsiteList(generics.ListAPIView):
    """Public listing of active websites for main application (no auth)."""
    serializer_class = None
    permission_classes = [permissions.AllowAny]
    pagination_class = StandardResultsSetPagination
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['total_visits', 'created_at', 'name']
    ordering = ['-total_visits']  # Default ordering by total_visits descending

    def get_serializer_class(self):
        from .serializers import PublicWebsiteSerializer
        return PublicWebsiteSerializer

    def get_queryset(self):
        # Base: only active websites
        qs = Website.objects.filter(status='active').select_related('domain', 'user')

        # Support ?search= query across name, domain, description and creator fields
        q = self.request.query_params.get('search', '')
        if q:
            q = q.strip()
            qs = qs.filter(
                Q(name__icontains=q) |
                Q(domain__name__icontains=q) |
                Q(description__icontains=q) |
                Q(user__first_name__icontains=q) |
                Q(user__last_name__icontains=q) |
                Q(user__username__icontains=q)
            )

        return qs


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
    Analytics posted from outside, for a site named by its subdomain.

    Signed, because a subdomain identifies a site but does not authenticate
    anybody: it is public and guessable, so without a signature anyone could
    post whatever traffic they liked for anybody's website. The body is HMAC'd
    with `HOSTING_WEBHOOK_SECRET` and sent as `X-Ufazien-Signature`.

    Fails closed. With no secret configured this refuses everything rather than
    waving it through, which is the state the endpoint was in until now: no
    authentication at all, `website_id` taken straight from the body.

    The figures replace the day rather than adding to it. It used to do
    `analytics.page_views += ...`, so a retried delivery counted twice and
    `unique_visitors` — which cannot be added up at all, since the same person
    on two posts is one visitor — drifted further every time.

    Note that `aggregate_access_logs` is the normal source now. This is kept for
    anything that can measure what a log cannot, such as a page script
    reporting real sessions.
    """
    secret = getattr(settings, 'HOSTING_WEBHOOK_SECRET', '') or ''
    if not secret:
        return JsonResponse(
            {'error': 'Analytics webhook is not configured.'}, status=503
        )

    signature = request.headers.get('X-Ufazien-Signature', '')
    expected = hmac.new(secret.encode(), request.body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature, expected):
        return JsonResponse({'error': 'Bad signature.'}, status=401)

    try:
        data = json.loads(request.body)
    except (ValueError, TypeError):
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)

    subdomain = str(data.get('subdomain') or '').strip().lower()
    website = Website.objects.filter(name=subdomain).first() if subdomain else None
    if website is None:
        return JsonResponse({'error': 'Unknown website.'}, status=404)

    try:
        day = datetime.strptime(str(data.get('date')), '%Y-%m-%d').date()
    except (ValueError, TypeError):
        return JsonResponse({'error': 'A date of the form YYYY-MM-DD is required.'}, status=400)

    fields = {}
    for name in (
        'page_views', 'unique_visitors', 'avg_session_duration', 'bandwidth_used',
    ):
        if name in data:
            try:
                fields[name] = max(0, int(data[name]))
            except (TypeError, ValueError):
                return JsonResponse({'error': f'{name} must be a whole number.'}, status=400)
    if 'bounce_rate' in data:
        try:
            fields['bounce_rate'] = min(100.0, max(0.0, float(data['bounce_rate'])))
        except (TypeError, ValueError):
            return JsonResponse({'error': 'bounce_rate must be a number.'}, status=400)
    for name in ('top_pages', 'referrers'):
        if isinstance(data.get(name), list):
            fields[name] = data[name][:20]

    if not fields:
        return JsonResponse({'error': 'Nothing to record.'}, status=400)

    WebsiteAnalytics.objects.update_or_create(
        website=website, date=day, defaults=fields
    )

    return JsonResponse({'status': 'ok', 'website': subdomain, 'date': day.isoformat()})


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
