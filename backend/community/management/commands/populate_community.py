from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from community.models import Group, Forum, ForumPost, GroupMembership
import random

User = get_user_model()

class Command(BaseCommand):
    help = 'Populate community with sample data'

    def handle(self, *args, **options):
        self.stdout.write('Creating sample community data...')
        
        # Get or create users
        users = []
        for i in range(5):
            user, created = User.objects.get_or_create(
                username=f'student{i+1}',
                defaults={
                    'email': f'student{i+1}@ufaz.edu.az',
                    'first_name': f'Student{i+1}',
                    'last_name': 'UFAZ',
                    'is_active': True
                }
            )
            users.append(user)
            if created:
                self.stdout.write(f'Created user: {user.username}')

        # Create forums
        forums_data = [
            {
                'title': 'General Discussion',
                'description': 'General topics and campus life discussions',
                'category': 'general',
                'icon_name': 'MessageCircle',
                'color_class': 'bg-blue-500'
            },
            {
                'title': 'Academic Help',
                'description': 'Get help with your studies and assignments',
                'category': 'academic',
                'icon_name': 'Book',
                'color_class': 'bg-green-500'
            },
            {
                'title': 'Technology',
                'description': 'Discuss technology trends and programming',
                'category': 'tech',
                'icon_name': 'Code',
                'color_class': 'bg-purple-500'
            },
            {
                'title': 'Career Development',
                'description': 'Career advice and job opportunities',
                'category': 'career',
                'icon_name': 'Briefcase',
                'color_class': 'bg-orange-500'
            }
        ]

        forums = []
        for forum_data in forums_data:
            forum, created = Forum.objects.get_or_create(
                title=forum_data['title'],
                defaults=forum_data
            )
            forums.append(forum)
            if created:
                self.stdout.write(f'Created forum: {forum.title}')

        # Create groups
        groups_data = [
            {
                'name': 'CS301 - Database Systems',
                'description': 'Study group for Database Systems course. We meet weekly to discuss assignments and prepare for exams.',
                'category': 'study',
                'type': 'public',
                'max_members': 30,
                'course_code': 'CS301',
                'professor': 'Dr. Smith',
                'tags': ['database', 'sql', 'study-group']
            },
            {
                'name': 'Python Programming Club',
                'description': 'Learn and practice Python programming together. All skill levels welcome!',
                'category': 'tech',
                'type': 'public',
                'max_members': 25,
                'tags': ['python', 'programming', 'coding']
            },
            {
                'name': 'Math Study Group',
                'description': 'Collaborative study group for mathematics courses. We solve problems together and help each other understand complex concepts.',
                'category': 'academic',
                'type': 'public',
                'max_members': 20,
                'tags': ['mathematics', 'calculus', 'algebra']
            },
            {
                'name': 'Career Networking',
                'description': 'Connect with fellow students and professionals. Share job opportunities and career advice.',
                'category': 'career',
                'type': 'public',
                'max_members': 50,
                'tags': ['career', 'networking', 'jobs']
            }
        ]

        groups = []
        for group_data in groups_data:
            owner = random.choice(users)
            group, created = Group.objects.get_or_create(
                name=group_data['name'],
                defaults={**group_data, 'owner': owner}
            )
            groups.append(group)
            if created:
                # Add owner as member
                GroupMembership.objects.create(
                    user=owner,
                    group=group,
                    role='owner'
                )
                self.stdout.write(f'Created group: {group.name}')

        # Add some members to groups
        for group in groups:
            # Add 3-5 random members to each group
            num_members = random.randint(3, 5)
            available_users = [u for u in users if u != group.owner]
            selected_users = random.sample(available_users, min(num_members, len(available_users)))
            
            for user in selected_users:
                GroupMembership.objects.get_or_create(
                    user=user,
                    group=group,
                    defaults={'role': 'member'}
                )

        # Create forum posts
        posts_data = [
            {
                'title': 'Tips for acing your Database Systems final exam',
                'content': 'After taking the exam last semester, here are some key tips that helped me succeed:\n\n1. Focus on normalization - understand 1NF, 2NF, 3NF, and BCNF\n2. Practice SQL queries extensively\n3. Review transaction management and ACID properties\n4. Understand indexing and query optimization\n\nGood luck everyone!',
                'tags': ['database', 'exams', 'study-tips'],
                'forum': forums[1]  # Academic Help
            },
            {
                'title': 'New cafeteria menu - thoughts?',
                'content': 'The cafeteria has updated their menu this week. I tried the new pasta dish and it was actually pretty good! What do you all think about the changes?',
                'tags': ['cafeteria', 'food', 'campus-life'],
                'forum': forums[0]  # General Discussion
            },
            {
                'title': 'Best Python libraries for data science',
                'content': 'I\'m starting a data science project and wondering which Python libraries you all recommend. I\'m familiar with pandas and numpy, but what about matplotlib, seaborn, or scikit-learn?',
                'tags': ['python', 'data-science', 'programming'],
                'forum': forums[2]  # Technology
            },
            {
                'title': 'Internship opportunities for CS students',
                'content': 'I found some great internship opportunities at local tech companies. Here are a few that might interest CS students:\n\n1. Software Developer Intern at TechCorp\n2. Data Analyst Intern at DataSolutions\n3. Web Developer Intern at WebStudio\n\nAnyone else looking for internships?',
                'tags': ['internships', 'career', 'opportunities'],
                'forum': forums[3]  # Career Development
            }
        ]

        for post_data in posts_data:
            author = random.choice(users)
            post, created = ForumPost.objects.get_or_create(
                title=post_data['title'],
                defaults={
                    **post_data,
                    'author': author,
                    'view_count': random.randint(10, 100)
                }
            )
            if created:
                self.stdout.write(f'Created post: {post.title}')

        self.stdout.write(
            self.style.SUCCESS('Successfully populated community with sample data!')
        )
        self.stdout.write(f'Created {len(users)} users, {len(forums)} forums, {len(groups)} groups, and {len(posts_data)} posts')