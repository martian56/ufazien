from django.core.management.base import BaseCommand
from hosting.models import Database
import uuid


class Command(BaseCommand):
    help = 'Update existing databases with unique hosts'

    def handle(self, *args, **options):
        databases = Database.objects.filter(host='db.ufazien.com')
        updated_count = 0
        
        for database in databases:
            user_id_short = str(database.user.id)[:8] if database.user.id else 'user'
            random_suffix = uuid.uuid4().hex[:4]
            new_host = f"{database.name}-{user_id_short}-{random_suffix}.db.ufazien.com"
            
            database.host = new_host
            database.save()
            updated_count += 1
            
            self.stdout.write(
                self.style.SUCCESS(
                    f'Updated database "{database.name}" with host: {new_host}'
                )
            )
        
        self.stdout.write(
            self.style.SUCCESS(f'Successfully updated {updated_count} databases')
        )
