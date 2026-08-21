from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone
import uuid

User = get_user_model()


class SubscriptionPlan(models.Model):
    """Subscription plans for hosting services"""
    PLAN_CHOICES = [
        ('free', 'Free'),
        ('developer', 'Developer'),
        ('pro', 'Pro'),
        ('special', 'Special')
    ]
    
    name = models.CharField(max_length=50, choices=PLAN_CHOICES, unique=True)
    display_name = models.CharField(max_length=100)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    max_websites = models.IntegerField()
    max_databases = models.IntegerField()
    storage_limit_mb = models.IntegerField()  # Storage in MB
    bandwidth_limit_mb = models.IntegerField()  # Bandwidth in MB
    ssl_included = models.BooleanField(default=False)
    custom_domains = models.BooleanField(default=False)
    priority_support = models.BooleanField(default=False)
    backup_frequency_days = models.IntegerField(default=7)  # Days between backups
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.display_name

    class Meta:
        ordering = ['price']


class UserSubscription(models.Model):
    """User's current subscription"""
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('cancelled', 'Cancelled'),
        ('expired', 'Expired'),
        ('pending', 'Pending'),
    ]
    
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='subscription')
    plan = models.ForeignKey(SubscriptionPlan, on_delete=models.PROTECT)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    started_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    next_billing_date = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    stripe_subscription_id = models.CharField(max_length=255, null=True, blank=True)
    
    def __str__(self):
        return f"{self.user.username} - {self.plan.display_name}"

    @property
    def is_active(self):
        return self.status == 'active' and (not self.expires_at or self.expires_at > timezone.now())

    def get_usage_stats(self):
        """Calculate current usage statistics"""
        websites_count = self.user.websites.filter(status__in=['active', 'building']).count()
        databases_count = self.user.databases.count()
        
        # Calculate storage usage (sum of website storage + database sizes)
        website_storage = sum(
            website.storage_used_mb or 0
            for website in self.user.websites.all()
        )
        database_storage = sum(
            db.size_mb or 0
            for db in self.user.databases.all()
        )
        storage_used = website_storage + database_storage
        
        # Calculate bandwidth usage (this month)
        from django.utils import timezone
        from datetime import datetime
        current_month = timezone.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        bandwidth_used = sum(
            usage.bandwidth_mb for usage in BandwidthUsage.objects.filter(
                website__user=self.user,
                date__gte=current_month
            )
        )
        
        return {
            'websites': websites_count,
            'databases': databases_count,
            'storage_used_mb': storage_used,
            'storage_websites_mb': website_storage,
            'storage_databases_mb': database_storage,
            'bandwidth_mb': bandwidth_used,
        }


class Domain(models.Model):
    """Custom domains and subdomains"""
    DOMAIN_TYPES = [
        ('subdomain', 'Subdomain'),
        ('custom', 'Custom Domain'),
    ]
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('active', 'Active'),
        ('expired', 'Expired'),
        ('error', 'Error'),
    ]
    
    name = models.CharField(max_length=255)
    domain_type = models.CharField(max_length=20, choices=DOMAIN_TYPES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='domains')
    ssl_enabled = models.BooleanField(default=False)
    ssl_expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return self.name
    
    class Meta:
        unique_together = ['name', 'domain_type']


class Database(models.Model):
    """User databases"""
    DB_TYPES = [
        ('mysql', 'MySQL'),
        ('postgresql', 'PostgreSQL'),
    ]
    
    STATUS_CHOICES = [
        ('creating', 'Creating'),
        ('active', 'Active'),
        ('maintenance', 'Maintenance'),
        ('stopped', 'Stopped'),
        ('error', 'Error'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, unique=True)
    db_type = models.CharField(max_length=20, choices=DB_TYPES, default='mysql')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='creating')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='databases')
    host = models.CharField(max_length=255, default='db.ufazien.com')
    port = models.IntegerField(default=3306)
    username = models.CharField(max_length=100, blank=True)
    password = models.CharField(max_length=255, blank=True)  # encrypted storage recommended
    size_mb = models.IntegerField(default=0)
    error_message = models.TextField(blank=True)
    connection_info = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.name} ({self.db_type})"


class Website(models.Model):
    """User websites"""
    WEBSITE_TYPES = [
        ('static', 'Static HTML/CSS/JS'),
        ('php', 'PHP'),
        ('node', 'Node.js'),
        ('python', 'Python'),
    ]
    
    STATUS_CHOICES = [
        ('building', 'Building'),
        ('active', 'Active'),
        ('stopped', 'Stopped'),
        ('error', 'Error'),
        ('maintenance', 'Maintenance'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    website_type = models.CharField(max_length=20, choices=WEBSITE_TYPES, default='static')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='building')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='websites')
    domain = models.ForeignKey(Domain, on_delete=models.SET_NULL, null=True, blank=True)
    database = models.ForeignKey(Database, on_delete=models.SET_NULL, null=True, blank=True)
    
    # File storage and deployment
    git_repository = models.URLField(blank=True, null=True)
    deployment_branch = models.CharField(max_length=100, default='main')
    build_command = models.CharField(max_length=500, blank=True)
    install_command = models.CharField(max_length=500, blank=True)
    output_directory = models.CharField(max_length=255, default='dist')
    
    # Metrics
    storage_used_mb = models.IntegerField(default=0)
    last_deployment = models.DateTimeField(null=True, blank=True)
    total_visits = models.IntegerField(default=0)
    
    # Environment variables (JSON field)
    environment_variables = models.JSONField(default=dict, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return self.name
    
    @property
    def url(self):
        if self.domain:
            return f"https://{self.domain.name}"
        return f"https://{self.name}.ufazien.com"


class Deployment(models.Model):
    """Website deployment history"""
    STATUS_CHOICES = [
        ('queued', 'Queued'),
        ('building', 'Building'),
        ('deploying', 'Deploying'),
        ('success', 'Success'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    website = models.ForeignKey(Website, on_delete=models.CASCADE, related_name='deployments')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='queued')
    commit_hash = models.CharField(max_length=40, blank=True)
    commit_message = models.TextField(blank=True)
    build_log = models.TextField(blank=True)
    error_message = models.TextField(blank=True)
    deploy_time_seconds = models.IntegerField(null=True, blank=True)
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    def __str__(self):
        return f"{self.website.name} - {self.status}"
    
    class Meta:
        ordering = ['-started_at']


class SSLCertificate(models.Model):
    """SSL certificates for domains"""
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('active', 'Active'),
        ('expired', 'Expired'),
        ('error', 'Error'),
    ]
    
    domain = models.OneToOneField(Domain, on_delete=models.CASCADE, related_name='ssl_certificate')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    issuer = models.CharField(max_length=255, default='Let\'s Encrypt')
    issued_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    certificate_data = models.TextField(blank=True)  # PEM format
    private_key = models.TextField(blank=True)  # Should be encrypted
    auto_renew = models.BooleanField(default=True)
    
    def __str__(self):
        return f"SSL for {self.domain.name}"
    
    @property
    def days_until_expiry(self):
        if self.expires_at:
            delta = self.expires_at - timezone.now()
            return delta.days
        return None


class BandwidthUsage(models.Model):
    """Daily bandwidth usage tracking"""
    website = models.ForeignKey(Website, on_delete=models.CASCADE, related_name='bandwidth_usage')
    date = models.DateField()
    bandwidth_mb = models.IntegerField(default=0)
    requests_count = models.IntegerField(default=0)
    
    class Meta:
        unique_together = ['website', 'date']
        ordering = ['-date']


class WebsiteAnalytics(models.Model):
    """
    One day of a website's traffic.

    Filled in by `manage.py aggregate_access_logs`, which reads what nginx
    already writes for every request. Nothing wrote to this table before: the
    only writer was an unauthenticated webhook nothing called, so the analytics
    page fell back to `random.randint` figures and no user has ever seen their
    own traffic on it.
    """
    website = models.ForeignKey(Website, on_delete=models.CASCADE, related_name='analytics')
    date = models.DateField()
    page_views = models.IntegerField(default=0)
    unique_visitors = models.IntegerField(default=0)
    #: Bytes off the wire, all requests included — assets as well as pages,
    #: because that is what the bandwidth quota is actually spent on. The
    #: analytics page divides by 1024² to chart it in MB, so this is bytes and
    #: big enough to hold a busy month.
    bandwidth_used = models.BigIntegerField(default=0)
    #: Both zero from log aggregation, and honestly so: a log line is a
    #: request, not a session, so neither of these can be worked out from one.
    #: They need a script on the page. Left here rather than invented.
    bounce_rate = models.FloatField(default=0.0)
    avg_session_duration = models.IntegerField(default=0)  # seconds
    #: [{path, views}] and [{referrer, visits}], most first.
    top_pages = models.JSONField(default=list)
    referrers = models.JSONField(default=list)
    #: {desktop, mobile, tablet} -> page views, from the user agent. Rough on
    #: purpose — user agents lie — and a great deal closer than the invented
    #: percentages the page used to show.
    devices = models.JSONField(default=dict, blank=True)
    
    class Meta:
        unique_together = ['website', 'date']
        ordering = ['-date']


class BackupJob(models.Model):
    """Website and database backups"""
    BACKUP_TYPES = [
        ('website', 'Website Files'),
        ('database', 'Database'),
        ('full', 'Full Backup'),
    ]
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('running', 'Running'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='backups')
    website = models.ForeignKey(Website, on_delete=models.CASCADE, null=True, blank=True)
    database = models.ForeignKey(Database, on_delete=models.CASCADE, null=True, blank=True)
    backup_type = models.CharField(max_length=20, choices=BACKUP_TYPES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    file_path = models.CharField(max_length=500, blank=True)
    file_size_mb = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    def __str__(self):
        return f"{self.backup_type} backup - {self.status}"
    
    class Meta:
        ordering = ['-created_at']


class Invoice(models.Model):
    """Billing invoices"""
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('paid', 'Paid'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='invoices')
    subscription = models.ForeignKey(UserSubscription, on_delete=models.CASCADE)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default='USD')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    invoice_number = models.CharField(max_length=50, unique=True)
    billing_period_start = models.DateTimeField()
    billing_period_end = models.DateTimeField()
    due_date = models.DateTimeField()
    paid_at = models.DateTimeField(null=True, blank=True)
    stripe_invoice_id = models.CharField(max_length=255, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"Invoice {self.invoice_number} - {self.user.username}"
    
    class Meta:
        ordering = ['-created_at']


class ActivityLog(models.Model):
    """User activity logging"""
    ACTION_TYPES = [
        ('website_created', 'Website Created'),
        ('website_updated', 'Website Updated'),
        ('website_deployed', 'Website Deployed'),
        ('website_deleted', 'Website Deleted'),
        ('database_created', 'Database Created'),
        ('database_updated', 'Database Updated'),
        ('database_deleted', 'Database Deleted'),
        ('database_password_changed', 'Database Password Changed'),
        ('domain_added', 'Domain Added'),
        ('domain_updated', 'Domain Updated'),
        ('domain_deleted', 'Domain Deleted'),
        ('ssl_issued', 'SSL Certificate Issued'),
        ('ssl_created', 'SSL Certificate Created'),
        ('ssl_updated', 'SSL Certificate Updated'),
        ('ssl_deleted', 'SSL Certificate Deleted'),
        ('ssl_issue_failed', 'SSL Certificate Issue Failed'),
        ('subscription_upgraded', 'Subscription Upgraded'),
        ('subscription_cancelled', 'Subscription Cancelled'),
        ('backup_created', 'Backup Created'),
        ('backup_restored', 'Backup Restored'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='activity_logs')
    action = models.CharField(max_length=50, choices=ACTION_TYPES)
    description = models.TextField()
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.user.username} - {self.action}"
    
    class Meta:
        ordering = ['-created_at']
