import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Search, Plus, Lock, Unlock, Users, Star, StarOff, Settings, RefreshCw, Filter, Eye, EyeOff, Zap, ArrowLeft, Building2, Play, Trophy, Users2, Loader2, User, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import campusApi from '../../services/campusApi';
import { campusUserName, type Lobby, type LobbyListParams, type SavedLobby } from '../../services/campusTypes';
import { errorMessage } from '../../lib/api/errors';
import Select from "../../components/ui/Select"
import CharacterPicker from './CharacterPicker'
import { api } from '../../lib/api/client'
import Range from "../../components/ui/Range"
import { Checkbox } from "../../components/ui/checkbox"

const CampusSimulatorMenu = () => {
  const navigate = useNavigate();

  // Who the player is and what they are wearing, for the character picker.
  // Held here rather than in the picker so that saving updates the copy under
  // the preview — the picker would otherwise be telling the player they had
  // not chosen a moment after they did.
  const [me, setMe] = useState<{ id: number; campus_character: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ id: number; campus_character?: string }>('/auth/user/')
      .then((profile) => {
        if (cancelled) return;
        setMe({ id: profile.id, campus_character: profile.campus_character ?? '' });
      })
      // Deliberately quiet. The picker is one panel on a page whose job is
      // joining lobbies, and a failure here must not put an error banner over
      // that. The panel simply does not appear.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  const [activeTab, setActiveTab] = useState('browse');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateLobby, setShowCreateLobby] = useState(false);
  const [showQuickJoin, setShowQuickJoin] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordModalLobbyId, setPasswordModalLobbyId] = useState<string | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  // Open on a wide screen, closed on a phone. The filter block is a full
  // screenful, and on a phone it sat between the player and every lobby on the
  // page — you scrolled past the controls to reach the content.
  const [filterOpen, setFilterOpen] = useState(
    () => typeof window === 'undefined' || window.innerWidth >= 1024,
  );
  /** The character sheet, which is how a phone reaches the picker. */
  const [showCharacter, setShowCharacter] = useState(false);

  /**
   * Whether the sidebar is on screen at all.
   *
   * Used to mount one picker rather than hide one with a class. `hidden
   * lg:block` leaves it in the tree, and the picker owns a WebGL canvas
   * running a render loop — so a phone was driving an invisible turntable, and
   * screen readers were being offered the same six radios twice.
   */
  const [wide, setWide] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches,
  );

  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)');
    const sync = () => setWide(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);
  const [passwordFilter, setPasswordFilter] = useState('all'); // 'all', 'public', 'private'
  const [playerCountFilter, setPlayerCountFilter] = useState('all');
  const [sortBy, setSortBy] = useState('-created_at'); // API sorting field
  
  // API state
  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [savedLobbies, setSavedLobbies] = useState<SavedLobby[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  /** How many filters are narrowing the list, shown on the collapsed header. */
  const activeFilterCount = [
    searchTerm.trim() !== '',
    passwordFilter !== 'all',
    playerCountFilter !== 'all',
  ].filter(Boolean).length;

  const [error, setError] = useState<string | null>(null);
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
      const params: LobbyListParams = {
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
      setError(errorMessage(err, 'Failed to load lobbies'));
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
      // The endpoint paginates on some deployments and not others.
      setSavedLobbies(Array.isArray(response) ? response : (response?.results ?? []));
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
      setError(errorMessage(err, 'Failed to create lobby'));
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle click on join button - check if password is needed
   */
  const handleJoinButtonClick = (lobby: Lobby) => {
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
  const handleJoinLobby = async (lobbyId: string, password = '') => {
    setIsLoading(true);
    try {
      await campusApi.joinLobby(lobbyId, password);
      // Close password modal if open
      setShowPasswordModal(false);
      setPasswordInput('');
      setPasswordModalLobbyId(null);
      navigate(`/campus-simulator/${lobbyId}`);
    } catch (err) {
      setError(errorMessage(err, 'Failed to join lobby'));
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
        setError(errorMessage(err, 'No available lobbies found'));
      } finally {
        setIsLoading(false);
      }
    }
  };

  /**
   * Toggle saved status of a lobby
   */
  const toggleSaveLobby = async (lobbyId: string, isSaved?: boolean) => {
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
      campusUserName(lobby.host).toLowerCase().includes(searchTerm.toLowerCase());

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

  const LobbyCard = ({ lobby, isSaved = false }: { lobby: Lobby; isSaved?: boolean }) => {
    const playerPercentage = (lobby.current_players_count / lobby.max_players) * 100;
    const isNearFull = playerPercentage >= 80;
    const isFull = lobby.current_players_count >= lobby.max_players;

    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6 hover:border-gray-300 transition-colors group">
        <div className="flex justify-between items-start gap-2 mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {lobby.is_private ? (
                <Lock className="w-4 h-4 text-amber-600 shrink-0" aria-label="Private lobby" />
              ) : (
                <Unlock className="w-4 h-4 text-gray-400 shrink-0" aria-label="Open lobby" />
              )}
              <h3 className="text-lg font-bold text-gray-900 truncate">
                {lobby.name}
              </h3>
            </div>

            {/* Only when there is one. "No description provided" is a line of
                nothing on every card that has not got one, and on a phone that
                is a line per lobby. */}
            {lobby.description && (
              <p className="text-gray-500 text-sm mb-2 line-clamp-2">{lobby.description}</p>
            )}

            {/* The player count used to be here as well as over the bar below,
                which is the same number twice on a card that has to fit on a
                phone. The bar keeps it, because it also shows how full. */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
              {/* `a + ' ' + b || 'Unknown'` reads as `(a + ' ' + b) || 'Unknown'`,
                  and a template with a space in it is truthy even when both
                  halves are empty. A host who never set a name showed as
                  "Host:" followed by nothing, or "undefined undefined". */}
              <span className="truncate min-w-0">Host: {campusUserName(lobby.host)}</span>
              <span className="text-gray-400">
                {lobby.created_at ? new Date(lobby.created_at).toLocaleDateString() : 'Recently created'}
              </span>
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

        <div className="mb-3">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-400">Players</span>
            <span className={`${isNearFull ? 'text-orange-600' : 'text-gray-500'}`}>
              {lobby.current_players_count}/{lobby.max_players}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
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
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
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
      <div className="min-h-screen bg-white p-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6 lg:mb-8">
            <div className="flex items-start gap-3 min-w-0">
              <button
                onClick={() => navigate('/dashboard')}
                className="text-gray-500 hover:text-gray-900 transition-colors p-2 shrink-0"
                aria-label="Back to dashboard"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <div className="min-w-0">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 flex items-center gap-2 sm:gap-3">
                  <Building2 className="w-7 h-7 sm:w-9 sm:h-9 lg:w-10 lg:h-10 text-blue-500 shrink-0" />
                  <span className="truncate">Campus Simulator</span>
                </h1>
                <p className="hidden sm:block text-gray-500 mt-2">
                  Build and explore virtual campuses with friends in real-time 3D environments
                </p>
              </div>
            </div>

            <div className="flex gap-2 sm:gap-3 shrink-0">
              {/* Phones reach the picker through this; wide screens have it in
                  the sidebar and do not need a second way in. */}
              {me && (
                <button
                  onClick={() => setShowCharacter(true)}
                  aria-label="Change your character"
                  className="lg:hidden border border-gray-300 text-gray-700 hover:bg-gray-50 px-3 py-3 rounded-lg font-medium flex items-center gap-2 transition-colors shrink-0"
                >
                  <User className="w-5 h-5 shrink-0" />
                </button>
              )}
              <button
                onClick={() => setShowQuickJoin(true)}
                className="flex-1 lg:flex-none justify-center border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 sm:px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-colors"
              >
                <Zap className="w-5 h-5 shrink-0" />
                <span className="whitespace-nowrap">Quick Join</span>
              </button>
              <button
                onClick={() => setShowCreateLobby(true)}
                className="flex-1 lg:flex-none justify-center bg-blue-600 hover:bg-blue-700 text-white px-4 sm:px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-colors"
              >
                <Plus className="w-5 h-5 shrink-0" />
                <span className="whitespace-nowrap">
                  <span className="sm:hidden">Create</span>
                  <span className="hidden sm:inline">Create Lobby</span>
                </span>
              </button>
            </div>
          </div>

        {/* The character sheet. Bottom-anchored on a phone, which is where a
            thumb is, and centred once there is room for it. */}
        {showCharacter && me && !wide && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
            onClick={() => setShowCharacter(false)}
          >
            <div
              className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-lg border border-gray-200 p-5 max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <User className="w-5 h-5 text-blue-500 shrink-0" />
                  Your character
                </h2>
                <button
                  onClick={() => setShowCharacter(false)}
                  aria-label="Close"
                  className="text-gray-400 hover:text-gray-900 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <CharacterPicker
                layout="sheet"
                userId={me.id}
                chosen={me.campus_character}
                onChosen={(id) =>
                  setMe((prev) => (prev ? { ...prev, campus_character: id } : prev))
                }
              />
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-6">
            {error}
            <button
              onClick={() => setError(null)}
              className="float-right text-red-600 hover:text-red-800"
            >
              ×
            </button>
          </div>
        )}

        {/* Tabs and Controls */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar: who you are, then how to filter. Both are about the page
              rather than about one lobby, which is why they share a column. */}
          <div className="lg:w-80 lg:shrink-0">
            {me && wide && (
              <div className="bg-white border border-gray-200 rounded-lg p-5 mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <User className="w-5 h-5 text-blue-500 shrink-0" />
                  <h3 className="text-lg font-semibold text-gray-900">Your character</h3>
                </div>
                <CharacterPicker
                  layout="sidebar"
                  userId={me.id}
                  chosen={me.campus_character}
                  onChosen={(id) =>
                    setMe((prev) => (prev ? { ...prev, campus_character: id } : prev))
                  }
                />
              </div>
            )}

            <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6 mb-6">
              <button
                type="button"
                onClick={() => setFilterOpen(!filterOpen)}
                aria-expanded={filterOpen}
                className="w-full flex items-center justify-between gap-2 text-left"
              >
                <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
                <span className="flex items-center gap-2 text-gray-400">
                  {activeFilterCount > 0 && (
                    <span className="rounded-full bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-0.5">
                      {activeFilterCount}
                    </span>
                  )}
                  <Filter className="w-5 h-5" />
                </span>
              </button>

              {filterOpen && (
                <div className="space-y-4 mt-4">
                  {/* Search */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Search Lobbies
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search by name, description..."
                        className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400"
                      />
                    </div>
                  </div>

                  {/* Privacy Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Privacy
                    </label>
                    <Select
        value={passwordFilter}
        onChange={(value) => setPasswordFilter(value)}
        options={[
          { value: "all", label: "All Lobbies" },
          { value: "public", label: "Public Only" },
          { value: "private", label: "Private Only" },
        ]}
      />
                  </div>

                  {/* Player Count Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Player Count
                    </label>
                    <Select
        value={playerCountFilter}
        onChange={(value) => setPlayerCountFilter(value)}
        options={[
          { value: "all", label: "Any Size" },
          { value: "1-5", label: "Small (1-5)" },
          { value: "6-10", label: "Medium (6-10)" },
          { value: "11-15", label: "Large (11-15)" },
          { value: "16+", label: "Extra Large (16+)" },
        ]}
      />
                  </div>

                  {/* Sort By */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Sort By
                    </label>
                    <Select
        value={sortBy}
        onChange={(value) => setSortBy(value)}
        options={[
          { value: "-created_at", label: "Newest First" },
          { value: "created_at", label: "Oldest First" },
          { value: "-current_players_count", label: "Most Players" },
          { value: "current_players_count", label: "Fewest Players" },
          { value: "name", label: "Name A-Z" },
          { value: "-name", label: "Name Z-A" },
        ]}
      />
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
                      className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {/* Tab Navigation */}
            <div className="flex space-x-1 mb-6 bg-gray-100 p-1 rounded-lg">
              {[
                { key: 'browse', label: 'Browse Lobbies', icon: Search },
                { key: 'saved', label: 'Saved Lobbies', icon: Star },
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 sm:px-4 rounded-md font-medium text-sm sm:text-base whitespace-nowrap transition-all ${
                    activeTab === key
                      ? 'bg-white text-gray-900 border border-gray-200'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="sm:hidden">{label.replace(' Lobbies', '')}</span>
                  <span className="hidden sm:inline">{label}</span>
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
                className="text-gray-400 hover:text-gray-900 transition-colors p-2"
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
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                >
                  Previous
                </button>
                
                <span className="text-gray-400">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.totalPages, prev.page + 1) }))}
                  disabled={pagination.page === pagination.totalPages || isLoading}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                >
                  Next
                </button>
              </div>
            )}

            {/* Empty State */}
            {!isLoading && filteredLobbies.length === 0 && (
              <div className="text-center py-12">
                <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
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
          <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg border border-gray-200 p-6 w-full max-w-md">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Create New Lobby</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Lobby Name *
                  </label>
                  <input
                    type="text"
                    value={newLobby.name}
                    onChange={(e) => setNewLobby(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter lobby name..."
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={newLobby.description}
                    onChange={(e) => setNewLobby(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe your lobby..."
                    rows={3}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Players: {newLobby.max_players}
                  </label>
                  <Range
                    min={2}
                    max={20}
                    value={newLobby.max_players}
                    onValueChange={(value) => setNewLobby(prev => ({ ...prev, max_players: value }))}
                    aria-label="Maximum players"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>2</span>
                    <span>20</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Checkbox
                    id="private"
                    checked={newLobby.is_private}
                    onCheckedChange={(checked) => setNewLobby(prev => ({
                      ...prev,
                      is_private: checked,
                      password: checked ? prev.password : ''
                    }))}
                  />
                  <label htmlFor="private" className="text-gray-700">
                    Private Lobby (requires password)
                  </label>
                </div>

                {newLobby.is_private && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Password
                    </label>
                    <input
                      type="password"
                      value={newLobby.password}
                      onChange={(e) => setNewLobby(prev => ({ ...prev, password: e.target.value }))}
                      placeholder="Enter password..."
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400"
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowCreateLobby(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
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
          <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg border border-gray-200 p-6 w-full max-w-md">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Quick Join</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Lobby ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={quickJoinData.lobbyId}
                    onChange={(e) => setQuickJoinData(prev => ({ ...prev, lobbyId: e.target.value }))}
                    placeholder="Enter 8-digit lobby ID..."
                    maxLength={8}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Leave empty to join any available lobby
                  </p>
                </div>

                {quickJoinData.lobbyId && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Password (if required)
                    </label>
                    <input
                      type="password"
                      value={quickJoinData.password}
                      onChange={(e) => setQuickJoinData(prev => ({ ...prev, password: e.target.value }))}
                      placeholder="Enter password if needed..."
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400"
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowQuickJoin(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleQuickJoin}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Joining...' : 'Join Now'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Password Modal for Password-Protected Lobbies */}
        {showPasswordModal && passwordModalLobbyId && (
          <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg border border-gray-200 p-6 w-full max-w-md">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Password Required</h2>
              <p className="text-gray-500 text-sm mb-6">
                This lobby is password-protected. Please enter the password to join.
              </p>
              
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
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
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400"
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
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
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
