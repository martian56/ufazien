import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Search, Plus, Lock, Unlock, Users, Star, StarOff, Settings, RefreshCw, Filter, Eye, EyeOff, Zap, ArrowLeft, Building2, Play, Trophy, Users2, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import campusApi from '../../services/campusApi';

const CampusSimulatorMenu = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('browse');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateLobby, setShowCreateLobby] = useState(false);
  const [showQuickJoin, setShowQuickJoin] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordModalLobbyId, setPasswordModalLobbyId] = useState(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [filterOpen, setFilterOpen] = useState(true);
  const [passwordFilter, setPasswordFilter] = useState('all'); // 'all', 'public', 'private'
  const [playerCountFilter, setPlayerCountFilter] = useState('all');
  const [sortBy, setSortBy] = useState('-created_at'); // API sorting field
  
  // API state
  const [lobbies, setLobbies] = useState([]);
  const [savedLobbies, setSavedLobbies] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, totalCount: 0 });
  
  // Quick Join state
  const [quickJoinData, setQuickJoinData] = useState({
    lobbyId: '',
    hasPassword: false,
    password: ''
  });
  
  // Create lobby state
  const [newLobby, setNewLobby] = useState({
    name: '',
    description: '',
    max_players: 12,
    is_private: false,
    password: ''
  });

  // Load lobbies on component mount and when filters change
  useEffect(() => {
    loadLobbies();
  }, [searchTerm, passwordFilter, playerCountFilter, sortBy, pagination.page]);

  // Load saved lobbies if on saved tab
  useEffect(() => {
    if (activeTab === 'saved') {
      loadSavedLobbies();
    }
  }, [activeTab]);

  /**
   * Load lobbies from API with current filters
   */
  const loadLobbies = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = {
        page: pagination.page,
        page_size: 20,
        ordering: sortBy,
        search: searchTerm || undefined
      };

      // Add privacy filter
      if (passwordFilter === 'public') {
        params.is_private = false;
      } else if (passwordFilter === 'private') {
        params.is_private = true;
      }

      // Add player count filter
      if (playerCountFilter !== 'all') {
        const [min, max] = playerCountFilter.split('-').map(Number);
        if (max) {
          params.min_players = min;
          params.max_players = max;
        } else {
          params.min_players = min;
        }
      }

      const response = await campusApi.getLobbies(params);
      
      
      setLobbies(response.results || []);
      setPagination({
        page: pagination.page,
        totalPages: Math.ceil((response.count || 0) / 20),
        totalCount: response.count || 0
      });
    } catch (err) {
      setError(err.message || 'Failed to load lobbies');
      console.error('Failed to load lobbies:', err);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Load user's saved lobbies
   */
  const loadSavedLobbies = async () => {
    if (!campusApi.isAuthenticated()) return;

    try {
      const response = await campusApi.getSavedLobbies();
      setSavedLobbies(response || []);
    } catch (err) {
      console.error('Failed to load saved lobbies:', err);
    }
  };

  /**
   * Create a new lobby
   */
  const handleCreateLobby = async () => {
    if (!newLobby.name.trim()) {
      setError('Lobby name is required');
      return;
    }

    setIsLoading(true);
    try {
      const createdLobby = await campusApi.createLobby(newLobby);
      
      // Navigate directly to the new lobby
      navigate(`/campus-simulator/${createdLobby.id}`);
    } catch (err) {
      setError(err.message || 'Failed to create lobby');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle click on join button - check if password is needed
   */
  const handleJoinButtonClick = (lobby) => {
    if (lobby.is_private) {
      // Show password modal for password-protected lobbies
      setPasswordModalLobbyId(lobby.id);
      setPasswordInput('');
      setShowPasswordModal(true);
    } else {
      // Join directly if no password required
      handleJoinLobby(lobby.id);
    }
  };

  /**
   * Join a specific lobby
   */
  const handleJoinLobby = async (lobbyId, password = '') => {
    setIsLoading(true);
    try {
      await campusApi.joinLobby(lobbyId, password);
      // Close password modal if open
      setShowPasswordModal(false);
      setPasswordInput('');
      setPasswordModalLobbyId(null);
      navigate(`/campus-simulator/${lobbyId}`);
    } catch (err) {
      setError(err.message || 'Failed to join lobby');
      // Keep password modal open on error so user can retry
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle password modal submit
   */
  const handlePasswordSubmit = () => {
    if (!passwordInput.trim()) {
      setError('Please enter a password');
      return;
    }
    if (passwordModalLobbyId) {
      handleJoinLobby(passwordModalLobbyId, passwordInput);
    }
  };

  /**
   * Quick join an available lobby
   */
  const handleQuickJoin = async () => {
    if (quickJoinData.lobbyId) {
      // Join specific lobby by ID
      handleJoinLobby(quickJoinData.lobbyId, quickJoinData.password);
    } else {
      // Quick join any available lobby
      setIsLoading(true);
      try {
        const response = await campusApi.quickJoinLobby(20, true);
        // Handle both response formats: {lobby: {...}} or direct lobby object
        const lobby = response.lobby || response;
        navigate(`/campus-simulator/${lobby.id}`);
      } catch (err) {
        setError(err.message || 'No available lobbies found');
      } finally {
        setIsLoading(false);
      }
    }
  };

  /**
   * Toggle saved status of a lobby
   */
  const toggleSaveLobby = async (lobbyId, isSaved) => {
    try {
      if (isSaved) {
        await campusApi.unsaveLobby(lobbyId);
      } else {
        await campusApi.saveLobby(lobbyId);
      }
      
      // Refresh lobbies to update saved status
      loadLobbies();
      if (activeTab === 'saved') {
        loadSavedLobbies();
      }
    } catch (err) {
      console.error('Failed to toggle save status:', err);
    }
  };

  /**
   * Apply filters and refresh lobbies
   */
  const applyFilters = () => {
    setPagination(prev => ({ ...prev, page: 1 }));
    loadLobbies();
  };

  /**
   * Reset all filters
   */
  const resetFilters = () => {
    setSearchTerm('');
    setPasswordFilter('all');
    setPlayerCountFilter('all');
    setSortBy('-created_at');
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // Filter lobbies based on current filters (for real-time filtering)
  const filteredLobbies = lobbies.filter(lobby => {
    const matchesSearch = !searchTerm || 
      lobby.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lobby.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (lobby.host?.first_name + ' ' + lobby.host?.last_name || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesPassword = passwordFilter === 'all' ||
      (passwordFilter === 'public' && !lobby.is_private) ||
      (passwordFilter === 'private' && lobby.is_private);

    const matchesPlayerCount = playerCountFilter === 'all' ||
      (playerCountFilter === '1-5' && lobby.current_players_count <= 5) ||
      (playerCountFilter === '6-10' && lobby.current_players_count >= 6 && lobby.current_players_count <= 10) ||
      (playerCountFilter === '11-15' && lobby.current_players_count >= 11 && lobby.current_players_count <= 15) ||
      (playerCountFilter === '16+' && lobby.current_players_count >= 16);

    return matchesSearch && matchesPassword && matchesPlayerCount;
  });

  const LobbyCard = ({ lobby, isSaved = false }) => {
    const playerPercentage = (lobby.current_players_count / lobby.max_players) * 100;
    const isNearFull = playerPercentage >= 80;
    const isFull = lobby.current_players_count >= lobby.max_players;

    return (
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 hover:border-blue-500 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/20 group">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors">
                {lobby.name}
              </h3>
              {lobby.is_private ? (
                <Lock className="w-4 h-4 text-yellow-500" />
              ) : (
                <Unlock className="w-4 h-4 text-green-500" />
              )}
              <span className="text-xs bg-gray-700 px-2 py-1 rounded-full text-gray-300">
                ID: {lobby.id}
              </span>
            </div>
            
            <p className="text-gray-400 text-sm mb-3 line-clamp-2">
              {lobby.description || 'No description provided'}
            </p>
            
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                {lobby.current_players_count}/{lobby.max_players}
              </span>
              <span>Host: {lobby.host?.first_name + ' ' + lobby.host?.last_name || 'Unknown'}</span>
              <span>{lobby.created_at ? new Date(lobby.created_at).toLocaleDateString() : 'Recently created'}</span>
            </div>
          </div>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleSaveLobby(lobby.id, isSaved);
            }}
            className="text-gray-400 hover:text-yellow-500 transition-colors p-2"
          >
            {isSaved ? <Star className="w-5 h-5 fill-current" /> : <StarOff className="w-5 h-5" />}
          </button>
        </div>

        <div className="mb-4">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-400">Players</span>
            <span className={`${isNearFull ? 'text-orange-500' : 'text-gray-400'}`}>
              {lobby.current_players_count}/{lobby.max_players}
            </span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                isFull ? 'bg-red-500' : isNearFull ? 'bg-orange-500' : 'bg-blue-500'
              }`}
              style={{ width: `${Math.min(playerPercentage, 100)}%` }}
            />
          </div>
        </div>

        <button
          onClick={() => handleJoinButtonClick(lobby)}
          disabled={isFull || isLoading}
          className={`w-full py-3 px-4 rounded-lg font-medium transition-all ${
            isFull
              ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white hover:shadow-lg hover:shadow-blue-500/30'
          }`}
        >
          {isFull ? 'Lobby Full' : lobby.is_private ? 'Join (Password Required)' : 'Join Lobby'}
        </button>
      </div>
    );
  };

  return (
    <>
      <Helmet>
        <title>Ufazien | Campus Simulator</title>
        <meta name="description" content="Build and explore virtual campuses with friends in real-time 3D environments." />
      </Helmet>
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-indigo-900 p-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6 lg:mb-8">
            <div className="flex items-start gap-3 min-w-0">
              <button
                onClick={() => navigate('/dashboard')}
                className="text-gray-400 hover:text-white transition-colors p-2 shrink-0"
                aria-label="Back to dashboard"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <div className="min-w-0">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white flex items-center gap-2 sm:gap-3">
                  <Building2 className="w-7 h-7 sm:w-9 sm:h-9 lg:w-10 lg:h-10 text-blue-500 shrink-0" />
                  <span className="truncate">Campus Simulator</span>
                </h1>
                <p className="hidden sm:block text-gray-400 mt-2">
                  Build and explore virtual campuses with friends in real-time 3D environments
                </p>
              </div>
            </div>

            <div className="flex gap-2 sm:gap-3 shrink-0">
              <button
                onClick={() => setShowQuickJoin(true)}
                className="flex-1 lg:flex-none justify-center bg-green-600 hover:bg-green-700 text-white px-4 sm:px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-all hover:shadow-lg hover:shadow-green-500/30"
              >
                <Zap className="w-5 h-5 shrink-0" />
                Quick Join
              </button>
              <button
                onClick={() => setShowCreateLobby(true)}
                className="flex-1 lg:flex-none justify-center bg-blue-600 hover:bg-blue-700 text-white px-4 sm:px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-all hover:shadow-lg hover:shadow-blue-500/30"
              >
                <Plus className="w-5 h-5 shrink-0" />
                Create Lobby
              </button>
            </div>
          </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 p-4 rounded-lg mb-6">
            {error}
            <button
              onClick={() => setError(null)}
              className="float-right text-red-300 hover:text-white"
            >
              ×
            </button>
          </div>
        )}

        {/* Tabs and Controls */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar Filters */}
          <div className="lg:w-80">
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Filters</h3>
                <button
                  onClick={() => setFilterOpen(!filterOpen)}
                  className="text-gray-400 hover:text-white"
                >
                  <Filter className="w-5 h-5" />
                </button>
              </div>

              {filterOpen && (
                <div className="space-y-4">
                  {/* Search */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Search Lobbies
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search by name, description..."
                        className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Privacy Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Privacy
                    </label>
                    <select
                      value={passwordFilter}
                      onChange={(e) => setPasswordFilter(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                    >
                      <option value="all">All Lobbies</option>
                      <option value="public">Public Only</option>
                      <option value="private">Private Only</option>
                    </select>
                  </div>

                  {/* Player Count Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Player Count
                    </label>
                    <select
                      value={playerCountFilter}
                      onChange={(e) => setPlayerCountFilter(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                    >
                      <option value="all">Any Size</option>
                      <option value="1-5">Small (1-5)</option>
                      <option value="6-10">Medium (6-10)</option>
                      <option value="11-15">Large (11-15)</option>
                      <option value="16+">Extra Large (16+)</option>
                    </select>
                  </div>

                  {/* Sort By */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Sort By
                    </label>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                    >
                      <option value="-created_at">Newest First</option>
                      <option value="created_at">Oldest First</option>
                      <option value="-current_players_count">Most Players</option>
                      <option value="current_players_count">Fewest Players</option>
                      <option value="name">Name A-Z</option>
                      <option value="-name">Name Z-A</option>
                    </select>
                  </div>

                  <div className="flex gap-2 pt-4">
                    <button
                      onClick={applyFilters}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium transition-colors"
                    >
                      Apply
                    </button>
                    <button
                      onClick={resetFilters}
                      className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded-lg font-medium transition-colors"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {/* Tab Navigation */}
            <div className="flex space-x-1 mb-6 bg-gray-800 p-1 rounded-lg">
              {[
                { key: 'browse', label: 'Browse Lobbies', icon: Search },
                { key: 'saved', label: 'Saved Lobbies', icon: Star },
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-md font-medium transition-all ${
                    activeTab === key
                      ? 'bg-blue-600 text-white shadow-lg'
                      : 'text-gray-400 hover:text-white hover:bg-gray-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>

            {/* Results Info */}
            <div className="flex items-center justify-between mb-6">
              <div className="text-gray-400">
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading lobbies...
                  </div>
                ) : (
                  `Showing ${filteredLobbies.length} of ${pagination.totalCount} lobbies`
                )}
              </div>
              
              <button
                onClick={loadLobbies}
                disabled={isLoading}
                className="text-gray-400 hover:text-white transition-colors p-2"
              >
                <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Lobbies Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
              {activeTab === 'browse' &&
                filteredLobbies.map((lobby) => (
                  <LobbyCard key={lobby.id} lobby={lobby} />
                ))}
              
              {activeTab === 'saved' &&
                savedLobbies.map((savedLobby) => (
                  <LobbyCard key={savedLobby.lobby.id} lobby={savedLobby.lobby} isSaved={true} />
                ))}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex justify-center items-center gap-2">
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                  disabled={pagination.page === 1 || isLoading}
                  className="px-4 py-2 bg-gray-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600 transition-colors"
                >
                  Previous
                </button>
                
                <span className="text-gray-400">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.totalPages, prev.page + 1) }))}
                  disabled={pagination.page === pagination.totalPages || isLoading}
                  className="px-4 py-2 bg-gray-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600 transition-colors"
                >
                  Next
                </button>
              </div>
            )}

            {/* Empty State */}
            {!isLoading && filteredLobbies.length === 0 && (
              <div className="text-center py-12">
                <Building2 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-400 mb-2">
                  {activeTab === 'saved' ? 'No saved lobbies' : 'No lobbies found'}
                </h3>
                <p className="text-gray-500 mb-6">
                  {activeTab === 'saved' 
                    ? 'Save lobbies you enjoy to quickly access them later.'
                    : 'Try adjusting your filters or create a new lobby to get started.'
                  }
                </p>
                {activeTab === 'browse' && (
                  <button
                    onClick={() => setShowCreateLobby(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                  >
                    Create First Lobby
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Create Lobby Modal */}
        {showCreateLobby && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 w-full max-w-md">
              <h2 className="text-2xl font-bold text-white mb-6">Create New Lobby</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Lobby Name *
                  </label>
                  <input
                    type="text"
                    value={newLobby.name}
                    onChange={(e) => setNewLobby(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter lobby name..."
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={newLobby.description}
                    onChange={(e) => setNewLobby(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe your lobby..."
                    rows={3}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Max Players: {newLobby.max_players}
                  </label>
                  <input
                    type="range"
                    min="2"
                    max="20"
                    value={newLobby.max_players}
                    onChange={(e) => setNewLobby(prev => ({ ...prev, max_players: parseInt(e.target.value) }))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>2</span>
                    <span>20</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="private"
                    checked={newLobby.is_private}
                    onChange={(e) => setNewLobby(prev => ({ 
                      ...prev, 
                      is_private: e.target.checked,
                      password: e.target.checked ? prev.password : ''
                    }))}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="private" className="text-gray-300">
                    Private Lobby (requires password)
                  </label>
                </div>

                {newLobby.is_private && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Password
                    </label>
                    <input
                      type="password"
                      value={newLobby.password}
                      onChange={(e) => setNewLobby(prev => ({ ...prev, password: e.target.value }))}
                      placeholder="Enter password..."
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowCreateLobby(false)}
                  className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateLobby}
                  disabled={!newLobby.name.trim() || isLoading}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Creating...' : 'Create Lobby'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Quick Join Modal */}
        {showQuickJoin && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 w-full max-w-md">
              <h2 className="text-2xl font-bold text-white mb-6">Quick Join</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Lobby ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={quickJoinData.lobbyId}
                    onChange={(e) => setQuickJoinData(prev => ({ ...prev, lobbyId: e.target.value }))}
                    placeholder="Enter 8-digit lobby ID..."
                    maxLength={8}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Leave empty to join any available lobby
                  </p>
                </div>

                {quickJoinData.lobbyId && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Password (if required)
                    </label>
                    <input
                      type="password"
                      value={quickJoinData.password}
                      onChange={(e) => setQuickJoinData(prev => ({ ...prev, password: e.target.value }))}
                      placeholder="Enter password if needed..."
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowQuickJoin(false)}
                  className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleQuickJoin}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Joining...' : 'Join Now'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Password Modal for Password-Protected Lobbies */}
        {showPasswordModal && passwordModalLobbyId && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 w-full max-w-md">
              <h2 className="text-2xl font-bold text-white mb-2">Password Required</h2>
              <p className="text-gray-400 text-sm mb-6">
                This lobby is password-protected. Please enter the password to join.
              </p>
              
              {error && (
                <div className="mb-4 p-3 bg-red-900/50 border border-red-500/50 rounded-lg text-red-200 text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Password *
                  </label>
                  <input
                    type="password"
                    value={passwordInput}
                    onChange={(e) => {
                      setPasswordInput(e.target.value);
                      setError(null); // Clear error when user types
                    }}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handlePasswordSubmit();
                      }
                    }}
                    placeholder="Enter lobby password..."
                    autoFocus
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowPasswordModal(false);
                    setPasswordModalLobbyId(null);
                    setPasswordInput('');
                    setError(null);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePasswordSubmit}
                  disabled={!passwordInput.trim() || isLoading}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Joining...' : 'Join Lobby'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
};

export default CampusSimulatorMenu;
