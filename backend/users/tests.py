from django.test import TestCase

# Create your tests here.

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
        self.assertEqual(response.status_code, 201)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        self.assertIn('user', response.data)    

    def test_login(self):
        # Test the login functionality
        response = self.client.post('/api/auth/login/', {
            'email': self.user_data['email'],
            'password': self.user_data['password']
        })
        self.assertEqual(response.status_code, 200)
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
        self.assertEqual(response.data['detail'], 'Invalid credentials')    
    
    def test_signup_existing_user(self):
        # Test signup with an existing user
        self.client.post('/api/auth/signup/', self.user_data)
        response = self.client.post('/api/auth/signup/', self.user_data)
        self.assertEqual(response.status_code, 400)
        self.assertIn('email', response.data)
        self.assertIn('This field must be unique.', response.data['email'])

