/**
 * Campus Simulator API Service
 * Handles REST API communication with the Django backend
 */

const API_BASE_URL = process.env.NODE_ENV === 'production' 
    ? window.location.origin 
    : 'http://localhost:8000';

class CampusApiService {
    constructor() {
        this.baseUrl = `${API_BASE_URL}/api/game`;
    }

    /**
     * Get authentication headers
     * @returns {Object} Headers with authorization
     */
    getAuthHeaders() {
        const token = localStorage.getItem('access');
        return {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
        };
    }

    /**
     * Make authenticated API request
     * @param {string} endpoint - API endpoint
     * @param {Object} options - Fetch options
     * @returns {Promise<Object>} Response data
     */
    async apiRequest(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        
        const config = {
            headers: this.getAuthHeaders(),
            ...options,
            headers: {
                ...this.getAuthHeaders(),
                ...options.headers
            }
        };

        console.log('API Request:', url, config);

        try {
            const response = await fetch(url, config);
            
            console.log('API Response Status:', response.status);
            
            if (!response.ok) {
                let errorMessage = `HTTP ${response.status}`;
                try {
                    // Try to read as text first, then parse as JSON if possible
                    const errorText = await response.text();
                    console.log('API Error Text:', errorText);
                    
                    // Try to parse the text as JSON
                    try {
                        const errorData = JSON.parse(errorText);
                        console.log('API Error Data:', errorData);
                        errorMessage = errorData.detail || errorData.message || errorData.error || JSON.stringify(errorData);
                    } catch (jsonParseError) {
                        // If it's not JSON, use the text as is
                        errorMessage = errorText || errorMessage;
                    }
                } catch (textError) {
                    console.log('Failed to read error response:', textError);
                    errorMessage = `HTTP ${response.status}`;
                }
                throw new Error(errorMessage);
            }

            const data = await response.json();
            console.log('API Response Data:', data);
            return data;
        } catch (error) {
            console.error(`API request failed for ${endpoint}:`, error);
            throw error;
        }
    }

    /**
     * Get all public lobbies with optional filtering and pagination
     * @param {Object} params - Query parameters
     * @param {number} params.page - Page number (default: 1)
     * @param {number} params.page_size - Items per page (default: 20)
     * @param {string} params.search - Search term
     * @param {string} params.ordering - Ordering field (-created_at, current_players_count, etc.)
     * @returns {Promise<Object>} Paginated lobbies response
     */
    async getLobbies(params = {}) {
        const queryParams = new URLSearchParams();
        
        // Set default parameters
        const defaultParams = {
            page: 1,
            page_size: 20,
            ordering: '-created_at',
            ...params
        };

        Object.entries(defaultParams).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                queryParams.append(key, value);
            }
        });

        return this.apiRequest(`/lobbies/?${queryParams.toString()}`);
    }

    /**
     * Get specific lobby details
     * @param {string} lobbyId - 8-digit lobby ID
     * @returns {Promise<Object>} Lobby details
     */
    async getLobby(lobbyId) {
        return this.apiRequest(`/lobbies/${lobbyId}/`);
    }

    /**
     * Create a new lobby
     * @param {Object} lobbyData - Lobby creation data
     * @param {string} lobbyData.name - Lobby name
     * @param {string} lobbyData.description - Lobby description
     * @param {number} lobbyData.max_players - Maximum players (2-20)
     * @param {boolean} lobbyData.is_private - Whether lobby is private
     * @param {string} lobbyData.password - Optional password for private lobbies
     * @returns {Promise<Object>} Created lobby data
     */
    async createLobby(lobbyData) {
        return this.apiRequest('/lobbies/', {
            method: 'POST',
            body: JSON.stringify(lobbyData)
        });
    }

    /**
     * Update lobby settings (host only)
     * @param {string} lobbyId - 8-digit lobby ID
     * @param {Object} updateData - Data to update
     * @returns {Promise<Object>} Updated lobby data
     */
    async updateLobby(lobbyId, updateData) {
        return this.apiRequest(`/lobbies/${lobbyId}/`, {
            method: 'PUT',
            body: JSON.stringify(updateData)
        });
    }

    /**
     * Delete lobby (host only)
     * @param {string} lobbyId - 8-digit lobby ID
     * @returns {Promise<void>}
     */
    async deleteLobby(lobbyId) {
        return this.apiRequest(`/lobbies/${lobbyId}/`, {
            method: 'DELETE'
        });
    }

    /**
     * Join a lobby with optional password
     * @param {string} lobbyId - 8-digit lobby ID
     * @param {string} password - Password if required
     * @returns {Promise<Object>} Join response with lobby data
     */
    async joinLobby(lobbyId, password = '') {
        console.log('joinLobby called with:', { lobbyId, password });
        
        // First try to leave any current lobby to avoid "already in lobby" errors
        try {
            await this.forceLeaveCurrentLobby();
        } catch (error) {
            console.log('No current lobby to leave or failed to leave:', error.message);
        }
        
        const requestBody = {
            lobby_id: lobbyId,
            password: password
        };
        console.log('Sending request body:', requestBody);
        
        return this.apiRequest('/join/', {
            method: 'POST',
            body: JSON.stringify(requestBody)
        });
    }

    /**
     * Quick join an available lobby
     * @param {number} max_players - Preferred maximum players
     * @param {boolean} public_only - Only join public lobbies
     * @returns {Promise<Object>} Joined lobby data
     */
    async quickJoinLobby(max_players = 20, public_only = true) {
        // First try to leave any current lobby
        try {
            await this.forceLeaveCurrentLobby();
        } catch (error) {
            console.log('No current lobby to leave or failed to leave:', error.message);
        }
        
        return this.apiRequest('/quick-join/', {
            method: 'POST',
            body: JSON.stringify({
                max_players,
                public_only
            })
        });
    }

    /**
     * Leave current lobby
     * @param {string} lobbyId - 8-digit lobby ID
     * @returns {Promise<void>}
     */
    async leaveLobby(lobbyId) {
        return this.apiRequest(`/lobbies/${lobbyId}/leave/`, {
            method: 'POST'
        });
    }

    /**
     * Get user's current lobbies
     * @returns {Promise<Array>} List of user's current lobbies
     */
    async getMyLobbies() {
        return this.apiRequest('/my-lobbies/', {
            method: 'GET'
        });
    }

    /**
     * Force leave any current lobby
     * @returns {Promise<void>}
     */
    async forceLeaveCurrentLobby() {
        console.log('Attempting to force leave current lobby');
        try {
            // First, get user's current lobbies
            const myLobbies = await this.apiRequest('/my-lobbies/', {
                method: 'GET'
            });
            
            console.log('User current lobbies:', myLobbies);
            
            // Leave each lobby the user is currently in
            for (const lobby of myLobbies) {
                console.log('Leaving lobby:', lobby.id);
                await this.apiRequest(`/lobbies/${lobby.id}/leave/`, {
                    method: 'POST'
                });
                console.log('Successfully left lobby:', lobby.id);
            }
        } catch (error) {
            // Ignore errors - user might not be in any lobby
            console.log('Force leave result:', error.message);
        }
    }

    /**
     * Get lobby members
     * @param {string} lobbyId - 8-digit lobby ID
     * @returns {Promise<Array>} List of lobby members
     */
    async getLobbyMembers(lobbyId) {
        const lobby = await this.apiRequest(`/lobbies/${lobbyId}/`);
        return lobby.members || [];
    }

    /**
     * Get player positions in lobby (handled via WebSocket)
     * @param {string} lobbyId - 8-digit lobby ID
     * @returns {Promise<Array>} Empty array (positions come via WebSocket)
     */
    async getPlayerPositions(lobbyId) {
        // Positions are handled in real-time via WebSocket
        // This method exists for compatibility but returns empty array
        return [];
    }

    /**
     * Get chat messages for lobby (handled via WebSocket)
     * @param {string} lobbyId - 8-digit lobby ID
     * @param {number} limit - Number of messages to retrieve (default: 50)
     * @returns {Promise<Array>} Empty array (messages come via WebSocket)
     */
    async getChatMessages(lobbyId, limit = 50) {
        // Chat messages are handled in real-time via WebSocket
        // This method exists for compatibility but returns empty array
        return [];
    }

    /**
     * Get study rooms in lobby
     * @param {string} lobbyId - 8-digit lobby ID
     * @returns {Promise<Array>} List of study rooms
     */
    async getStudyRooms(lobbyId) {
        const lobby = await this.apiRequest(`/lobbies/${lobbyId}/`);
        return lobby.study_rooms || [];
    }

    /**
     * Save lobby to user's favorites
     * @param {string} lobbyId - 8-digit lobby ID
     * @returns {Promise<Object>} Save response
     */
    async saveLobby(lobbyId) {
        return this.apiRequest('/saved-lobbies/', {
            method: 'POST',
            body: JSON.stringify({ lobby_id: lobbyId })
        });
    }

    /**
     * Remove lobby from user's favorites
     * @param {string} lobbyId - 8-digit lobby ID
     * @returns {Promise<void>}
     */
    async unsaveLobby(lobbyId) {
        return this.apiRequest(`/saved-lobbies/${lobbyId}/`, {
            method: 'DELETE'
        });
    }

    /**
     * Get user's saved lobbies
     * @returns {Promise<Array>} List of saved lobbies
     */
    async getSavedLobbies() {
        return this.apiRequest('/saved-lobbies/');
    }

    /**
     * Search lobbies by name or description
     * @param {string} query - Search query
     * @param {Object} filters - Additional filters
     * @returns {Promise<Object>} Search results
     */
    async searchLobbies(query, filters = {}) {
        const params = {
            search: query,
            ...filters
        };
        return this.getLobbies(params);
    }

    /**
     * Get lobby statistics
     * @returns {Promise<Object>} Lobby statistics
     */
    async getLobbyStats() {
        return this.apiRequest('/lobbies/stats/');
    }

    /**
     * Check if user is authenticated
     * @returns {boolean} Authentication status
     */
    isAuthenticated() {
        return !!localStorage.getItem('access');
    }

    /**
     * Set authentication token
     * @param {string} token - JWT access token
     */
    setAuthToken(token) {
        localStorage.setItem('access_token', token);
    }

    /**
     * Clear authentication token
     */
    clearAuthToken() {
        localStorage.removeItem('access_token');
    }

    /**
     * Refresh authentication token
     * @returns {Promise<string>} New access token
     */
    async refreshToken() {
        const refreshToken = localStorage.getItem('refresh_token');
        if (!refreshToken) {
            throw new Error('No refresh token available');
        }

        const response = await fetch(`${API_BASE_URL}/api/auth/token/refresh/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                refresh: refreshToken
            })
        });

        if (!response.ok) {
            throw new Error('Failed to refresh token');
        }

        const data = await response.json();
        this.setAuthToken(data.access);
        return data.access;
    }
}

// Create singleton instance
const campusApi = new CampusApiService();

export default campusApi;
