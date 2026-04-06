from django.apps import AppConfig


class UfazienConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'ufazien'
    
    def ready(self):
        """Load auditlog configuration when Django starts"""
        try:
            import auditlog_config
        except ImportError:
            pass  # auditlog_config might not be available in all environments

