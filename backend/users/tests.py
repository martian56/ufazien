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



class UserSettingsTests(APITestCase):
    """Settings lived in localStorage, so they were per-browser and per-device."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="settingsuser", email="settings@example.com", password="pw"
        )
        self.other = User.objects.create_user(
            username="settingsother", email="other@example.com", password="pw"
        )
        self.client.force_authenticate(user=self.user)

    def test_settings_are_created_on_first_read_with_sane_defaults(self):
        response = self.client.get("/api/auth/settings/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["profile_visibility"], "everyone")
        self.assertTrue(response.json()["email_notifications"])

    def test_a_saved_setting_survives_a_new_session(self):
        self.client.patch("/api/auth/settings/", {"theme": "dark"}, format="json")

        fresh = APIClient()
        fresh.force_authenticate(user=self.user)
        self.assertEqual(fresh.get("/api/auth/settings/").json()["theme"], "dark")

    def test_settings_are_the_users_own_and_not_shared(self):
        self.client.patch("/api/auth/settings/", {"theme": "dark"}, format="json")

        self.client.force_authenticate(user=self.other)
        self.assertEqual(self.client.get("/api/auth/settings/").json()["theme"], "light")

    def test_settings_require_authentication(self):
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get("/api/auth/settings/").status_code, 401)

    def test_a_partial_update_leaves_the_rest_alone(self):
        self.client.patch("/api/auth/settings/", {"theme": "dark"}, format="json")
        self.client.patch("/api/auth/settings/", {"language": "az"}, format="json")

        body = self.client.get("/api/auth/settings/").json()
        self.assertEqual(body["theme"], "dark")
        self.assertEqual(body["language"], "az")


class ProfileVisibilityTests(APITestCase):
    """The Privacy tab offered this setting and nothing ever read it."""

    def setUp(self):
        self.owner = User.objects.create_user(
            username="pvowner", email="pvowner@example.com", password="pw"
        )
        self.follower = User.objects.create_user(
            username="pvfollower", email="pvfollower@example.com", password="pw"
        )
        self.stranger = User.objects.create_user(
            username="pvstranger", email="pvstranger@example.com", password="pw"
        )
        self.owner.followers.add(self.follower)

    def _set_visibility(self, value):
        self.client.force_authenticate(user=self.owner)
        self.client.patch("/api/auth/settings/", {"profile_visibility": value}, format="json")

    def _fetch_as(self, user):
        self.client.force_authenticate(user=user)
        return self.client.get(f"/api/auth/user/{self.owner.id}/").json()

    def test_everyone_sees_a_public_profile(self):
        self._set_visibility("everyone")
        body = self._fetch_as(self.stranger)
        self.assertNotIn("profile_restricted", body)
        self.assertIn("followers_count", body)

    def test_a_nobody_profile_is_withheld_from_everyone_else(self):
        self._set_visibility("nobody")
        body = self._fetch_as(self.stranger)
        self.assertTrue(body["profile_restricted"])
        self.assertNotIn("bio", body)
        self.assertNotIn("followers_count", body)

    def test_a_followers_profile_opens_for_followers_only(self):
        self._set_visibility("followers")
        self.assertNotIn("profile_restricted", self._fetch_as(self.follower))
        self.assertTrue(self._fetch_as(self.stranger)["profile_restricted"])

    def test_your_own_profile_is_always_visible_to_you(self):
        self._set_visibility("nobody")
        self.client.force_authenticate(user=self.owner)
        body = self.client.get("/api/auth/user/me/").json()
        self.assertNotIn("profile_restricted", body)
        self.assertEqual(body["email"], "pvowner@example.com")

    def test_a_restricted_profile_still_does_not_leak_the_email(self):
        """The standing rule: an address reaches nobody but its owner."""
        self._set_visibility("nobody")
        self.assertNotIn("email", self._fetch_as(self.stranger))

    def test_an_unrestricted_profile_still_does_not_leak_the_email(self):
        self._set_visibility("everyone")
        self.assertNotIn("email", self._fetch_as(self.stranger))
