from rest_framework import serializers

from api.sanitize import PlainTextFieldsMixin

from . import domains
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
    """
    A domain, whose name is a filesystem path before it is an address.

    `domains.check()` was wired into the website creation path and not into
    this one, so `POST /api/hosting/domains/` took the name exactly as typed.
    `../etc` split to an empty first label and rooted the site at
    `/srv/hosting` itself, which `path_within` then measured containment
    against — every tenant's files, through the call meant to separate them.

    Syntax is not enough on its own. A custom domain is not hosted on anybody's
    behalf and so is not checked against the reserved list or the base domain,
    but its first label still names the directory: `alice.attacker.com` is a
    valid hostname pointing at Alice's site. The label has to be free, not just
    well formed.
    """

    class Meta:
        model = Domain
        fields = [
            'id', 'name', 'domain_type', 'status', 'ssl_enabled',
            'ssl_expires_at', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'status', 'ssl_enabled', 'ssl_expires_at', 'created_at', 'updated_at']

    def validate_name(self, value):
        try:
            return domains.check(value)
        except ValueError as problem:
            raise serializers.ValidationError(str(problem))

    def validate(self, data):
        name = data.get('name') or getattr(self.instance, 'name', None)
        if not name:
            return data

        taken = Domain.objects.filter(name=name)
        if self.instance is not None:
            taken = taken.exclude(pk=self.instance.pk)
        if taken.exists():
            raise serializers.ValidationError({'name': f"“{name}” is already taken."})

        request = self.context.get('request')
        owner = getattr(request, 'user', None)
        label = domains.site_label(name)

        held = Domain.objects.exclude(user=owner) if owner is not None else Domain.objects.all()
        if self.instance is not None:
            held = held.exclude(pk=self.instance.pk)
        for other in held.values_list('name', flat=True).iterator(chunk_size=500):
            if domains.site_label(other) == label:
                raise serializers.ValidationError(
                    {'name': f"“{label}” is already in use. Please choose another."}
                )

        return data


class DatabaseSerializer(serializers.ModelSerializer):
    """
    A user's database, credentials included.

    `password` is readable — the owner needs it to connect, and the queryset is
    scoped to them — but no longer writable. The browser used to generate it
    with `Math.random()` and post it, and whatever it sent became the real
    password on the real database. `Math.random()` is not a cryptographic
    generator: its state is recoverable from a handful of outputs, and the
    shape was fixed besides. The server mints it now, from `uuid4()`, which is
    `os.urandom` underneath.

    `username` goes the same way and for the same reason: it was derived from
    the site's name in the browser, which made it guessable, and it is not the
    client's to choose.
    """

    class Meta:
        model = Database
        fields = [
            'id', 'name', 'db_type', 'status', 'host', 'port', 'username', 'password',
            'size_mb', 'created_at', 'updated_at', 'error_message', 'connection_info'
        ]
        read_only_fields = [
            'id', 'status', 'host', 'port', 'username', 'password',
            'size_mb', 'created_at', 'updated_at', 'error_message', 'connection_info'
        ]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Password is intentionally shown to the user (not write-only).
        if instance.status != 'active':
            data['connection_info'] = {}
        return data


class WebsiteSerializer(PlainTextFieldsMixin, serializers.ModelSerializer):
    domain = DomainSerializer(read_only=True)
    domain_id = serializers.IntegerField(write_only=True, required=False, allow_null=True, help_text="ID of existing domain to use")
    new_domain_name = serializers.CharField(write_only=True, required=False, allow_blank=True, help_text="Name of new domain to create")
    database = DatabaseSerializer(read_only=True)
    database_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    url = serializers.ReadOnlyField()

    plain_text_fields = {
        "name": dict(max_length=100),
        "description": dict(max_length=2000, keep_newlines=True),
    }

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
            # Normalised and checked in one place — see `hosting/domains.py`.
            # The name reaches the filesystem as the site's directory and nginx
            # as the root it serves, so it is not free text.
            try:
                new_domain_name = domains.check(new_domain_name)
            except ValueError as problem:
                raise serializers.ValidationError({'new_domain_name': str(problem)})
            data['new_domain_name'] = new_domain_name

            # Taken by anybody, not just by the person asking. This was scoped
            # to `user=request.user`, so claiming a name somebody else held
            # passed validation and then hit the unique constraint as an
            # IntegrityError — a 500 where 400 was meant, and a way to tell
            # which subdomains exist by the shape of the failure.
            if Domain.objects.filter(name=new_domain_name).exists():
                raise serializers.ValidationError(
                    {'new_domain_name': f"“{new_domain_name}” is already taken."}
                )

            # A free name is not yet a free directory. The site root is the
            # first label, and a custom domain may carry somebody else's.
            request = self.context.get('request')
            owner = getattr(request, 'user', None)
            label = domains.site_label(new_domain_name)
            held = Domain.objects.exclude(user=owner) if owner is not None else Domain.objects.all()
            for other in held.values_list('name', flat=True).iterator(chunk_size=500):
                if domains.site_label(other) == label:
                    raise serializers.ValidationError(
                        {'new_domain_name': f"“{label}” is already in use. Please choose another."}
                    )

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
    """
    A site as anybody may see it: the public listing, and the campus screens.

    Deliberately not `WebsiteSerializer`, which carries the environment
    variables, the git repository and the build commands — everything needed to
    deploy the thing — and is only ever read by the site's own owner. This one
    is read by anybody, so it carries what a listing needs and nothing else. In
    particular there is no email: the creator is a display name.
    """
    domain = serializers.CharField(source='domain.name', read_only=True)
    creator = serializers.SerializerMethodField()
    url = serializers.ReadOnlyField()

    class Meta:
        model = Website
        fields = ('id', 'name', 'domain', 'url', 'creator', 'description', 'website_type', 'storage_used_mb', 'total_visits', 'status', 'created_at')

    def get_creator(self, obj):
        """
        What to call the person who made it.

        This used to join `first_name` and `last_name` unconditionally, and
        both default to the empty string — so every account that never filled
        in a name was credited as `" "`, a single space. On a listing that is
        the whole point of the field, an anonymous entry is worse than a
        username. Falls back to the username, and never to the email: an
        address is not the owner's to give away because they published a site.
        """
        owner = getattr(obj, 'user', None)
        if not owner:
            return None
        name = owner.get_full_name().strip() if hasattr(owner, 'get_full_name') else ''
        return name or getattr(owner, 'username', None)


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

