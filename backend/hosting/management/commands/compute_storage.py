from django.core.management.base import BaseCommand, CommandError
from hosting.tasks import compute_storage_for_all_users, compute_storage_for_user


class Command(BaseCommand):
    help = 'Compute storage usage for all users or a single user.'

    def add_arguments(self, parser):
        parser.add_argument('--user-id', type=int, help='Compute storage for a single user id')

    def handle(self, *args, **options):
        user_id = options.get('user_id')
        if user_id:
            self.stdout.write(f'Computing storage for user {user_id}...')
            # call synchronous function via task (task returns when run in eager mode)
            result = compute_storage_for_user(None, user_id)
            self.stdout.write(self.style.SUCCESS(f'Done. Result: {result}'))
        else:
            self.stdout.write('Computing storage for all users...')
            compute_storage_for_all_users()
            self.stdout.write(self.style.SUCCESS('Scheduled compute for all users.'))
