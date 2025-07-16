from django.core.management.base import BaseCommand
from gpa.models import AcademicYear, Semester

class Command(BaseCommand):
    help = 'Create initial academic structure for UFAZ (L1, L2, L3)'

    def handle(self, *args, **options):
        # Create Academic Years
        academic_years_data = [
            {'name': 'L1', 'description': 'First Year (License 1)', 'order': 1},
            {'name': 'L2', 'description': 'Second Year (License 2)', 'order': 2},
            {'name': 'L3', 'description': 'Third Year (License 3)', 'order': 3},
        ]

        for year_data in academic_years_data:
            year, created = AcademicYear.objects.get_or_create(
                name=year_data['name'],
                defaults={
                    'description': year_data['description'],
                    'order': year_data['order']
                }
            )
            if created:
                self.stdout.write(f"Created academic year: {year.name}")
            else:
                self.stdout.write(f"Academic year already exists: {year.name}")

            # Create semesters for each year
            for semester_num in [1, 2]:
                semester, created = Semester.objects.get_or_create(
                    academic_year=year,
                    number=semester_num,
                    defaults={
                        'name': f'Semester {semester_num}'
                    }
                )
                if created:
                    self.stdout.write(f"Created semester: {year.name} - {semester.name}")

        self.stdout.write(
            self.style.SUCCESS('Successfully created UFAZ academic structure')
        )
