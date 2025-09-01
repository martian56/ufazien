from rest_framework import serializers
from .models import (
    SubscriptionPlan, UserSubscription, Website, Database, Domain,
    Deployment, SSLCertificate, BandwidthUsage, WebsiteAnalytics,
    BackupJob, Invoice, ActivityLog
)


class SubscriptionPlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubscriptionPlan
        fields = [
            'name', 'display_name', 'price', 'max_websites', 'max_databases',
            'storage_limit_mb', 'bandwidth_limit_mb', 'ssl_included', 
            'custom_domains', 'priority_support', 'backup_frequency_days'
        ]


class UserSubscriptionSerializer(serializers.ModelSerializer):
    plan = SubscriptionPlanSerializer(read_only=True)
    # Expose computed usage fields so frontend can read subscription.storage_used_mb directly
    storage_used_mb = serializers.SerializerMethodField()
    storage_websites_mb = serializers.SerializerMethodField()
    storage_databases_mb = serializers.SerializerMethodField()
    bandwidth_used_mb = serializers.SerializerMethodField()
    
    class Meta:
        model = UserSubscription
        fields = [
            'plan', 'status', 'started_at', 'expires_at', 'next_billing_date',
            'cancelled_at', 'storage_used_mb', 'storage_websites_mb', 'storage_databases_mb', 'bandwidth_used_mb'
        ]
        read_only_fields = ['started_at', 'expires_at', 'next_billing_date', 'cancelled_at']

    def _usage(self, obj):
        try:
            return obj.get_usage_stats() or {}
        except Exception:
            return {}

    def get_storage_used_mb(self, obj):
        return self._usage(obj).get('storage_used_mb', 0)

    def get_storage_websites_mb(self, obj):
        return self._usage(obj).get('storage_websites_mb', 0)

    def get_storage_databases_mb(self, obj):
         return self._usage(obj).get('storage_databases_mb', 0)

    def get_bandwidth_used_mb(self, obj):
         return self._usage(obj).get('bandwidth_mb', 0)


class DomainSerializer(serializers.ModelSerializer):
    class Meta:
        model = Domain
        fields = [
            'id', 'name', 'domain_type', 'status', 'ssl_enabled', 
            'ssl_expires_at', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'status', 'ssl_enabled', 'ssl_expires_at', 'created_at', 'updated_at']


class DatabaseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Database
        fields = [
            'id', 'name', 'db_type', 'status', 'host', 'port', 'username', 'password',
            'size_mb', 'created_at', 'updated_at', 'error_message', 'connection_info'
        ]
        read_only_fields = [
            'id', 'status', 'host', 'port', 
            'size_mb', 'created_at', 'updated_at', 'error_message', 'connection_info'
        ]
        extra_kwargs = {
            'password': {'required': False}
        }

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Password is intentionally shown to the user (not write-only).
        if instance.status != 'active':
            data['connection_info'] = {}
        return data


class WebsiteSerializer(serializers.ModelSerializer):
    domain = DomainSerializer(read_only=True)
    domain_id = serializers.IntegerField(write_only=True, required=False, allow_null=True, help_text="ID of existing domain to use")
    new_domain_name = serializers.CharField(write_only=True, required=False, allow_blank=True, help_text="Name of new domain to create")
    database = DatabaseSerializer(read_only=True)
    database_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    url = serializers.ReadOnlyField()
    
    class Meta:
        model = Website
        fields = [
            'id', 'name', 'description', 'website_type', 'status', 'domain',
            'domain_id', 'new_domain_name', 'database', 'database_id', 'git_repository', 'deployment_branch', 'build_command',
            'install_command', 'output_directory', 'storage_used_mb',
            'last_deployment', 'total_visits', 'environment_variables',
            'created_at', 'updated_at', 'url'
        ]
        read_only_fields = [
            'id', 'status', 'storage_used_mb', 'last_deployment', 'total_visits',
            'created_at', 'updated_at', 'url'
        ]
    
    def validate(self, data):
        """Validate that either domain_id or new_domain_name is provided, but not both"""
        domain_id = data.get('domain_id')
        new_domain_name = data.get('new_domain_name')
        
        if domain_id and new_domain_name:
            raise serializers.ValidationError("Provide either domain_id or new_domain_name, not both")
        
        if new_domain_name:
            # Validate domain name format
            if not new_domain_name.strip():
                raise serializers.ValidationError("new_domain_name cannot be empty")
            
            # Check if domain already exists
            request = self.context.get('request')
            if request and Domain.objects.filter(name=new_domain_name, user=request.user).exists():
                raise serializers.ValidationError(f"Domain '{new_domain_name}' already exists")
        
        return data


class DeploymentSerializer(serializers.ModelSerializer):
    website_name = serializers.CharField(source='website.name', read_only=True)
    
    class Meta:
        model = Deployment
        fields = [
            'id', 'website_name', 'status', 'commit_hash', 'commit_message',
            'build_log', 'error_message', 'deploy_time_seconds', 'started_at',
            'completed_at'
        ]
        read_only_fields = [
            'id', 'website_name', 'status', 'build_log', 'error_message',
            'deploy_time_seconds', 'started_at', 'completed_at'
        ]


class SSLCertificateSerializer(serializers.ModelSerializer):
    domain_name = serializers.CharField(source='domain.name', read_only=True)
    domain = serializers.CharField(write_only=True, help_text="Domain name for the certificate")
    days_until_expiry = serializers.ReadOnlyField()
    certificate_data = serializers.CharField(required=False, allow_blank=True, help_text="PEM format certificate")
    private_key = serializers.CharField(required=False, allow_blank=True, write_only=True, help_text="PEM format private key")
    
    class Meta:
        model = SSLCertificate
        fields = [
            'id', 'domain_name', 'domain', 'status', 'issuer', 'issued_at', 'expires_at',
            'auto_renew', 'days_until_expiry', 'certificate_data', 'private_key'
        ]
        read_only_fields = [
            'id', 'domain_name', 'status', 'issuer', 'issued_at', 'expires_at',
            'days_until_expiry'
        ]
        extra_kwargs = {
            'private_key': {'write_only': True}
        }
    
    def validate_domain(self, value):
        """Validate that the domain exists and belongs to the user"""
        request = self.context.get('request')
        if not request:
            raise serializers.ValidationError("Request context is required")
        
        try:
            # Try to find the domain
            domain = Domain.objects.get(name=value, user=request.user)
            return domain
        except Domain.DoesNotExist:
            # If domain doesn't exist, try to find a website with that subdomain pattern
            if value.endswith('.ufazien.com'):
                website_name = value.replace('.ufazien.com', '')
                try:
                    website = Website.objects.get(name__iexact=website_name, user=request.user)
                    # Create a domain if it doesn't exist
                    domain, created = Domain.objects.get_or_create(
                        name=value,
                        user=request.user,
                        defaults={
                            'domain_type': 'subdomain',
                            'status': 'active',
                            'ssl_enabled': True
                        }
                    )
                    return domain
                except Website.DoesNotExist:
                    pass
            
            # If no existing domain or website found, allow creating a new domain
            domain, created = Domain.objects.get_or_create(
                name=value,
                user=request.user,
                defaults={
                    'domain_type': 'custom' if not value.endswith('.ufazien.com') else 'subdomain',
                    'status': 'pending',
                    'ssl_enabled': True
                }
            )
            return domain
    
    def create(self, validated_data):
        """Create SSL certificate"""
        domain = validated_data.pop('domain')
        
        # Check if certificate already exists for this domain
        if SSLCertificate.objects.filter(domain=domain).exists():
            raise serializers.ValidationError("SSL certificate already exists for this domain")
        
        # Create the certificate
        certificate = SSLCertificate.objects.create(
            domain=domain,
            **validated_data
        )
        
        # If it's an auto certificate (no certificate_data provided), set appropriate defaults
        if not validated_data.get('certificate_data'):
            certificate.issuer = "Let's Encrypt"
            certificate.status = 'pending'  # Will be activated by background process
            certificate.save()
        else:
            certificate.issuer = 'Custom Certificate'
            certificate.status = 'active'
            certificate.save()
        
        return certificate


class BandwidthUsageSerializer(serializers.ModelSerializer):
    website_name = serializers.CharField(source='website.name', read_only=True)
    
    class Meta:
        model = BandwidthUsage
        fields = ['website_name', 'date', 'bandwidth_mb', 'requests_count']


class WebsiteAnalyticsSerializer(serializers.ModelSerializer):
    website_name = serializers.CharField(source='website.name', read_only=True)
    
    class Meta:
        model = WebsiteAnalytics
        fields = [
            'website_name', 'date', 'page_views', 'unique_visitors', 'bounce_rate',
            'avg_session_duration', 'top_pages', 'referrers'
        ]


class BackupJobSerializer(serializers.ModelSerializer):
    website_name = serializers.CharField(source='website.name', read_only=True)
    database_name = serializers.CharField(source='database.name', read_only=True)
    
    class Meta:
        model = BackupJob
        fields = [
            'id', 'website_name', 'database_name', 'backup_type', 'status',
            'file_path', 'file_size_mb', 'created_at', 'completed_at'
        ]
        read_only_fields = [
            'id', 'website_name', 'database_name', 'status', 'file_path',
            'file_size_mb', 'created_at', 'completed_at'
        ]


class InvoiceSerializer(serializers.ModelSerializer):
    plan_name = serializers.CharField(source='subscription.plan.display_name', read_only=True)
    
    class Meta:
        model = Invoice
        fields = [
            'id', 'plan_name', 'amount', 'currency', 'status', 'invoice_number',
            'billing_period_start', 'billing_period_end', 'due_date', 'paid_at',
            'created_at'
        ]
        read_only_fields = [
            'id', 'plan_name', 'amount', 'currency', 'status', 'invoice_number',
            'billing_period_start', 'billing_period_end', 'due_date', 'paid_at',
            'created_at'
        ]


class ActivityLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ActivityLog
        fields = [
            'action', 'description', 'metadata', 'created_at'
        ]
        read_only_fields = ['action', 'description', 'metadata', 'created_at']


# Additional serializers for specific use cases

class WebsiteSummarySerializer(serializers.ModelSerializer):
    """Lightweight serializer for website lists"""
    domain_name = serializers.CharField(source='domain.name', read_only=True)
    
    class Meta:
        model = Website
        fields = [
            'id', 'name', 'website_type', 'status', 'domain_name',
            'storage_used_mb', 'total_visits', 'last_deployment', 'created_at'
        ]


class PublicWebsiteSerializer(serializers.ModelSerializer):
    """Serializer used for public listing of websites (for main app)"""
    domain = serializers.CharField(source='domain.name', read_only=True)
    creator = serializers.SerializerMethodField()

    class Meta:
        model = Website
        fields = ('id', 'name', 'domain', 'creator', 'description', 'website_type', 'storage_used_mb', 'total_visits', 'status', 'created_at')

    def get_creator(self, obj):
        owner = getattr(obj, 'owner', None) or getattr(obj, 'user', None)
        if not owner:
            return None
        return getattr(owner, 'first_name', None) + ' ' + getattr(owner, 'last_name', None)


class DatabaseSummarySerializer(serializers.ModelSerializer):
    """Lightweight serializer for database lists"""
    
    class Meta:
        model = Database
        fields = [
            'id', 'name', 'db_type', 'status', 'host', 'port',
            'size_mb', 'created_at'
        ]


class DashboardStatsSerializer(serializers.Serializer):
    """Serializer for dashboard statistics"""
    total_websites = serializers.IntegerField()
    active_websites = serializers.IntegerField()
    total_databases = serializers.IntegerField()
    storage_used_mb = serializers.IntegerField()
    bandwidth_used_mb = serializers.IntegerField()
    total_visits = serializers.IntegerField()


class UsageStatsSerializer(serializers.Serializer):
    """Serializer for subscription usage statistics"""
    websites = serializers.IntegerField()
    databases = serializers.IntegerField()
    storage_mb = serializers.IntegerField()
    bandwidth_mb = serializers.IntegerField()


class SubscriptionLimitsSerializer(serializers.Serializer):
    """Serializer for subscription limits"""
    websites = serializers.IntegerField()
    databases = serializers.IntegerField()
    storage_mb = serializers.IntegerField()
    bandwidth_mb = serializers.IntegerField()
