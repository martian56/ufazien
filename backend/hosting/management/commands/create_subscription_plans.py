from django.core.management.base import BaseCommand
from hosting.models import SubscriptionPlan


class Command(BaseCommand):
    help = 'Create default subscription plans'

    def handle(self, *args, **options):
        plans = [
            {
                'name': 'free',
                'display_name': 'Free',
                'price': 0.00,
                'max_websites': 5,
                'max_databases': 5,
                'storage_limit_mb': 1024,  # 1GB
                'bandwidth_limit_mb': 10240,  # 10GB
                'ssl_included': False,
                'custom_domains': False,
                'priority_support': False,
                'backup_frequency_days': 30,
            },
            {
                'name': 'developer',
                'display_name': 'Developer',
                'price': 5.00,
                'max_websites': 10,
                'max_databases': 10,
                'storage_limit_mb': 10240,  # 10GB
                'bandwidth_limit_mb': 102400,  # 100GB
                'ssl_included': True,
                'custom_domains': True,
                'priority_support': False,
                'backup_frequency_days': 7,
            },
            {
                'name': 'pro',
                'display_name': 'Pro',
                'price': 10.00,
                'max_websites': 25,
                'max_databases': 25,
                'storage_limit_mb': 51200,  # 50GB
                'bandwidth_limit_mb': 512000,  # 500GB
                'ssl_included': True,
                'custom_domains': True,
                'priority_support': True,
                'backup_frequency_days': 1,
            },
            {
                'name': 'special',
                'display_name': 'Special',
                'price': 50.00,
                'max_websites': 100,
                'max_databases': 100,
                'storage_limit_mb': 51200,  # 50GB
                'bandwidth_limit_mb': 512000,  # 500GB
                'ssl_included': True,
                'custom_domains': True,
                'priority_support': True,
                'backup_frequency_days': 1,
            },
        ]

        for plan_data in plans:
            plan, created = SubscriptionPlan.objects.get_or_create(
                name=plan_data['name'],
                defaults=plan_data
            )
            
            if created:
                self.stdout.write(
                    self.style.SUCCESS(f'Created subscription plan: {plan.display_name}')
                )
            else:
                # Update existing plan with new data
                for key, value in plan_data.items():
                    setattr(plan, key, value)
                plan.save()
                self.stdout.write(
                    self.style.WARNING(f'Updated subscription plan: {plan.display_name}')
                )

        self.stdout.write(
            self.style.SUCCESS('Successfully created/updated all subscription plans')
        )
