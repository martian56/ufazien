/**
 * Campus Simulator API Service
 * Handles REST API communication with the Django backend
 */

import { api, ApiError } from '../lib/api/client';
import { clearTokens, setTokens } from '../lib/api/tokens';
import type {
    CampusChatMessage,
    Lobby,
    LobbyListParams,
    LobbyMember,
    LobbyStats,
    Paginated,
    PlayerPosition,
    SavedLobby,
} from './campusTypes';


class CampusApiService {

    /**
     * Make an authenticated API request.
     *
     * This used to be its own fetch wrapper with its own header building and
     * error parsing. The shared client does all of that, including refreshing
     * an expired token, so the endpoints below are unchanged.
     *
     * @param {string} endpoint - path under /game
     * @param {Object} options - method, body, params
     * @returns {Promise<Object>} parsed response
     */
    async apiRequest(
        endpoint: string,
        options: {
            method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
            body?: unknown;
            headers?: Record<string, string>;
        } = {},
    ): Promise<any> {
        const body = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
        try {
            const method = String(options.method || 'GET').toLowerCase() as 'get' | 'post' | 'put' | 'patch' | 'delete';
            return await (api[method] as (...args: any[]) => Promise<any>)(
                `/game${endpoint}`,
                ...(options.method && options.method !== 'GET' && options.method !== 'DELETE'
                    ? [body, { headers: options.headers }]
                    : [{ headers: options.headers }]),
            );
        } catch (error) {
            // Callers show error.message, so keep the server's own wording.
            if (error instanceof ApiError) throw new Error(error.userMessage);
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
    async getLobbies(params: LobbyListParams = {}): Promise<Paginated<Lobby>> {
        const queryParams = new URLSearchParams();
        
        // Set default parameters
        const defaultParams: LobbyListParams = {
            page: 1,
            page_size: 20,
            ordering: '-created_at',
            ...params
        };

        Object.entries(defaultParams).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                queryParams.append(key, String(value));
            }
        });

        return this.apiRequest(`/lobbies/?${queryParams.toString()}`);
    }

    /**
     * Get specific lobby details
     * @param {string} lobbyId - 8-digit lobby ID
     * @returns {Promise<Object>} Lobby details
     */
    async getLobby(lobbyId: string): Promise<Lobby> {
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
    async createLobby(lobbyData: {
        name: string;
        description?: string;
        max_players?: number;
        is_private?: boolean;
        password?: string;
    }): Promise<Lobby> {
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
    async updateLobby(lobbyId: string, updateData: Partial<Lobby>): Promise<Lobby> {
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
    async deleteLobby(lobbyId: string) {
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
    async joinLobby(lobbyId: string, password = '') {
        
        // Check if we're already in the target lobby. If so, skip force-leave
        try {
            const myLobbies = await this.apiRequest('/my-lobbies/', { method: 'GET' });
            const alreadyInTarget = Array.isArray(myLobbies) && myLobbies.some(l => String(l.id) === String(lobbyId));
            if (alreadyInTarget) {
                // Return the lobby object from myLobbies if available, else fetch it
                const existing = myLobbies.find(l => String(l.id) === String(lobbyId));
                if (existing) return existing;
                const lobbyObj = await this.getLobby(lobbyId);
                return lobbyObj;
            }

            // Leave any other current lobbies first to avoid "already in lobby" errors
            try {
                await this.forceLeaveCurrentLobby();
            } catch (error) {
            }
        } catch (err) {
            console.warn('Failed to check current lobbies before join, proceeding:', err);
            try {
                await this.forceLeaveCurrentLobby();
            } catch (error) {
            }
        }
        
        const requestBody = {
            lobby_id: lobbyId,
            password: password
        };
        
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
        }
        
        return this.apiRequest('/quick-join/', {
            method: 'POST',
            body: JSON.stringify({
                max_players_preference: max_players,
                preferred_lobby_type: public_only ? 'public' : 'any'
            })
        });
    }

    /**
     * Leave current lobby
     * @param {string} lobbyId - 8-digit lobby ID
     * @returns {Promise<void>}
     */
    async leaveLobby(lobbyId: string) {
        return this.apiRequest(`/lobbies/${lobbyId}/leave/`, {
            method: 'POST'
        });
    }

    /**
     * Get user's current lobbies
     * @returns {Promise<Array>} List of user's current lobbies
     */
    async getMyLobbies(): Promise<Lobby[] | Paginated<Lobby>> {
        return this.apiRequest('/my-lobbies/', {
            method: 'GET'
        });
    }

    /**
     * Force leave any current lobby
     * @returns {Promise<void>}
     */
    async forceLeaveCurrentLobby() {
        try {
            // First, get user's current lobbies
            const myLobbies = await this.apiRequest('/my-lobbies/', {
                method: 'GET'
            });
            
            
            // Leave each lobby the user is currently in
            for (const lobby of myLobbies) {
                await this.apiRequest(`/lobbies/${lobby.id}/leave/`, {
                    method: 'POST'
                });
            }
        } catch (error) {
            // Ignore errors - user might not be in any lobby
        }
    }

    /**
     * Get lobby members
     * @param {string} lobbyId - 8-digit lobby ID
     * @returns {Promise<Array>} List of lobby members
     */
    async getLobbyMembers(lobbyId: string): Promise<LobbyMember[]> {
        const lobby = await this.apiRequest(`/lobbies/${lobbyId}/`);
        return lobby.members || [];
    }

    /**
     * Get player positions in lobby (handled via WebSocket)
     * @param {string} lobbyId - 8-digit lobby ID
     * @returns {Promise<Array>} Empty array (positions come via WebSocket)
     */
    async getPlayerPositions(lobbyId: string): Promise<PlayerPosition[]> {
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
    async getChatMessages(lobbyId: string, limit = 50): Promise<CampusChatMessage[]> {
        // Chat messages are handled in real-time via WebSocket
        // This method exists for compatibility but returns empty array
        return [];
    }


    /**
     * Save lobby to user's favorites
     * @param {string} lobbyId - 8-digit lobby ID
     * @returns {Promise<Object>} Save response
     */
    async saveLobby(lobbyId: string) {
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
    async unsaveLobby(lobbyId: string) {
        return this.apiRequest(`/saved-lobbies/${lobbyId}/`, {
            method: 'DELETE'
        });
    }

    /**
     * Get user's saved lobbies
     * @returns {Promise<Array>} List of saved lobbies
     */
    async getSavedLobbies(): Promise<SavedLobby[] | Paginated<SavedLobby>> {
        return this.apiRequest('/saved-lobbies/');
    }

    /**
     * Search lobbies by name or description
     * @param {string} query - Search query
     * @param {Object} filters - Additional filters
     * @returns {Promise<Object>} Search results
     */
    async searchLobbies(query: string, filters: LobbyListParams = {}): Promise<Paginated<Lobby>> {
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
    async getLobbyStats(): Promise<LobbyStats> {
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
    setAuthToken(token: string) {
        setTokens(token);
    }

    /**
     * Clear authentication token
     */
    clearAuthToken() {
        clearTokens();
    }

}

// Create singleton instance
const campusApi = new CampusApiService();

export default campusApi;
