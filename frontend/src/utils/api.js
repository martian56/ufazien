// API configuration and utilities
const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000') + '/api';

// API client with token handling
class ApiClient {
  constructor() {
    this.baseURL = API_BASE_URL;
    this.token = localStorage.getItem('access');
  }

  setToken(token) {
    this.token = token;
    localStorage.setItem('access', token);
  }

  setTokens(accessToken, refreshToken) {
    this.token = accessToken;
    localStorage.setItem('access', accessToken);
    localStorage.setItem('refresh', refreshToken);
  }

  removeToken() {
    this.token = null;
    localStorage.removeItem('access');
    localStorage.removeItem('refresh');
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(this.token && { Authorization: `Bearer ${this.token}` }),
        ...options.headers,
      },
      ...options,
    };

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(url, config);
      
      if (response.status === 401) {
        // Try to refresh token
        const refreshToken = localStorage.getItem('refresh');
        if (refreshToken && !endpoint.includes('/auth/token/refresh/')) {
          try {
            const refreshResponse = await fetch(`${this.baseURL}/auth/token/refresh/`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refresh: refreshToken }),
            });
            
            if (refreshResponse.ok) {
              const { access } = await refreshResponse.json();
              this.setToken(access);
              
              // Retry original request with new token
              config.headers.Authorization = `Bearer ${access}`;
              const retryResponse = await fetch(url, config);
              
              if (retryResponse.ok) {
                const contentType = retryResponse.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                  return await retryResponse.json();
                }
                return retryResponse;
              }
            }
          } catch (refreshError) {
            console.error('Token refresh failed:', refreshError);
          }
        }
        
        // If refresh failed or no refresh token, logout
        this.removeToken();
        window.location.href = '/auth';
        return null;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }
      
      return response;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // GET request
  async get(endpoint) {
    return this.request(endpoint);
  }

  // POST request
  async post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: data,
    });
  }

  // PUT request
  async put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: data,
    });
  }

  // PATCH request
  async patch(endpoint, data) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: data,
    });
  }

  // DELETE request
  async delete(endpoint) {
    return this.request(endpoint, {
      method: 'DELETE',
    });
  }
}

// Create a singleton instance
const apiClient = new ApiClient();

export default apiClient;
