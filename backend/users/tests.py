from django.test import TestCase
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from decimal import Decimal

from .models import User, Major

class UserModelTest(TestCase):
    """Test cases for User model"""
    
    def setUp(self):
        self.user_data = {
            'email': 'test@example.com',
            'username': 'testuser',
            'first_name': 'Test',
            'last_name': 'User',
            'password': 'testpass123@A1'
        }
    
    def test_user_creation(self):
        """Test user is created correctly"""
        user = User.objects.create_user(**self.user_data)
        
        self.assertEqual(user.email, 'test@example.com')
        self.assertEqual(user.first_name, 'Test')
        self.assertEqual(user.last_name, 'User')
        self.assertEqual(user.major, Major.UNDECLARED)
        self.assertEqual(user.year, '1')
        self.assertEqual(user.gpa, Decimal('0.00'))
        self.assertEqual(user.completed_credits, 0)
        self.assertTrue(user.check_password('testpass123@A1'))
    
    def test_user_str_method(self):
        """Test user string representation"""
        user = User.objects.create_user(**self.user_data)
        expected_str = f"{user.first_name} {user.last_name}"
        self.assertEqual(str(user), expected_str)
    
    def test_user_major_choices(self):
        """Test user major field choices"""
        user = User.objects.create_user(**self.user_data)
        
        # Test setting different majors
        user.major = Major.COMPUTER_SCIENCE
        user.save()
        self.assertEqual(user.major, Major.COMPUTER_SCIENCE)
        
        user.major = Major.CHEMISTRY
        user.save()
        self.assertEqual(user.major, Major.CHEMISTRY)
    
    def test_user_followers_relationship(self):
        """Test user followers many-to-many relationship"""
        user1 = User.objects.create_user(
            first_name='User1',
            username='user1',
            last_name='Test1',
            email='user1@example.com',
            password='testpass123@A1'
        )
        user2 = User.objects.create_user(
            first_name='User2',
            username='user2',
            last_name='Test2',
            email='user2@example.com',
            password='testpass123@A1'
        )
        
        # user2 follows user1
        user1.followers.add(user2)
        
        # Test followers relationship
        self.assertEqual(user1.followers.count(), 1)
        self.assertIn(user2, user1.followers.all())
        
        # Test following relationship (reverse)
        self.assertEqual(user2.following.count(), 1)
        self.assertIn(user1, user2.following.all())

class AuthTests(TestCase):
    def setUp(self):
        # Set up any necessary data for the tests
        self.user_data = {
            'first_name': 'testuser',
            'last_name': 'testuser',
            'email': 'testuser@example.com',
            'password': 'testpassword@A1'
        }
    def test_signup(self):
        # Test the signup functionality
        response = self.client.post('/api/auth/signup/', self.user_data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        self.assertIn('user', response.data)    

    def test_login(self):
        response = self.client.post('/api/auth/signup/', self.user_data)
        # Test the login functionality
        response = self.client.post('/api/auth/login/', {
            'email': self.user_data['email'],
            'password': self.user_data['password']
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        self.assertIn('user', response.data)
    
    def test_login_invalid_credentials(self):
        # Test login with invalid credentials
        response = self.client.post('/api/auth/login/', {
            'email': 'invalid@example.com',
            'password': 'wrongpassword'
        })
        self.assertEqual(response.status_code, 401)
        self.assertIn('detail', response.data)
        self.assertEqual(response.data['detail'], 'Invalid credentials.')    
    
    # def test_signup_existing_user(self):
    #     # Test signup with an existing user
    #     self.client.post('/api/auth/signup/', self.user_data)
    #     response = self.client.post('/api/auth/signup/', self.user_data)
    #     self.assertEqual(response.status_code, 400)
    #     self.assertIn('username', response.data)
    #     self.assertIn('This field must be unique.', response.data['username'])

