import React, { useState, useEffect } from 'react';
import { Search, Plus, Lock, Unlock, Users, Star, StarOff, Settings, RefreshCw, Filter, Eye, EyeOff, Zap, ArrowLeft, Building2, Play, Trophy, Users2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const CampusSimulator = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('browse');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateLobby, setShowCreateLobby] = useState(false);
  const [showQuickJoin, setShowQuickJoin] = useState(false);
  const [filterOpen, setFilterOpen] = useState(true);
  const [passwordFilter, setPasswordFilter] = useState('all'); // 'all', 'public', 'private'
  const [playerCountFilter, setPlayerCountFilter] = useState('all');
  const [sortBy, setSortBy] = useState('players'); // 'players', 'name', 'created'
  
  // Quick Join state
  const [quickJoinData, setQuickJoinData] = useState({
    lobbyId: '',
    hasPassword: false,
    password: ''
  });
  
  // Mock data - replace with real API calls later
  const [lobbies, setLobbies] = useState([
    {
      id: 12345678,
      name: "University of Dreams",
      host: "Alice_2024",
      players: 8,
      maxPlayers: 12,
      hasPassword: false,
      description: "Building the perfect campus with friends! Join us for collaborative campus design and management.",
      tags: ["Cooperative", "Building", "Strategy"],
      createdAt: "2 hours ago",
      isOnline: true
    },
    {
      id: 87654321,
      name: "Elite Campus Challenge",
      host: "ProBuilder99",
      players: 15,
      maxPlayers: 16,
      hasPassword: true,
      description: "Competitive campus building - experienced players only! Test your skills against the best builders.",
      tags: ["Competitive", "Expert", "Ranked"],
      createdAt: "30 minutes ago",
      isOnline: true
    },
    {
      id: 11223344,
      name: "Chill Campus Vibes",
      host: "RelaxedGamer",
      players: 4,
      maxPlayers: 8,
      hasPassword: false,
      description: "Relaxed building, no pressure, all welcome! Perfect for beginners and casual players.",
      tags: ["Casual", "Creative", "Friendly"],
      createdAt: "1 hour ago",
      isOnline: true
    },
    {
      id: 99887766,
      name: "Speedrun Campus",
      host: "FastBuilder",
      players: 6,
      maxPlayers: 10,
      hasPassword: true,
      description: "Fast-paced campus building challenges! Can you build the ultimate university in record time?",
      tags: ["Speedrun", "Challenge", "Timed"],
      createdAt: "45 minutes ago",
      isOnline: true
    }
  ]);

  const [myLobbies, setMyLobbies] = useState([
    {
      id: 87654321,
      name: "Elite Campus Challenge",
      role: "Host",
      status: "Active",
      players: 15,
      maxPlayers: 16
    }
  ]);

  const [savedLobbies, setSavedLobbies] = useState([12345678, 11223344]); // Array of lobby IDs
  
  const [newLobby, setNewLobby] = useState({
    name: '',
    maxPlayers: 8,
    hasPassword: false,
    password: '',
    description: '',
    tags: []
  });

  // Filter lobbies based on search and filters
  const filteredLobbies = lobbies.filter(lobby => {
    const matchesSearch = lobby.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         lobby.host.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         lobby.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesPassword = passwordFilter === 'all' || 
                           (passwordFilter === 'public' && !lobby.hasPassword) ||
                           (passwordFilter === 'private' && lobby.hasPassword);
    
    const matchesPlayers = playerCountFilter === 'all' ||
                          (playerCountFilter === 'low' && lobby.players <= 4) ||
                          (playerCountFilter === 'medium' && lobby.players > 4 && lobby.players <= 8) ||
                          (playerCountFilter === 'high' && lobby.players > 8);
    
    return matchesSearch && matchesPassword && matchesPlayers;
  }).sort((a, b) => {
    switch (sortBy) {
      case 'players':
        return b.players - a.players;
      case 'name':
        return a.name.localeCompare(b.name);
      case 'created':
        return new Date(b.createdAt) - new Date(a.createdAt);
      default:
        return 0;
    }
  });

  const toggleSavedLobby = (lobbyId) => {
    setSavedLobbies(prev => 
      prev.includes(lobbyId) 
        ? prev.filter(id => id !== lobbyId)
        : [...prev, lobbyId]
    );
  };

  const createLobby = () => {
    // Generate 8-digit lobby ID
    const lobbyId = Math.floor(10000000 + Math.random() * 90000000);
    
    const lobby = {
      id: lobbyId,
      name: newLobby.name,
      host: "You", // Replace with actual username
      players: 1,
      maxPlayers: newLobby.maxPlayers,
      hasPassword: newLobby.hasPassword,
      description: newLobby.description,
      tags: newLobby.tags,
      createdAt: "Just now",
      isOnline: true
    };
    
    setLobbies(prev => [lobby, ...prev]);
    setMyLobbies(prev => [...prev, { ...lobby, role: "Host", status: "Active" }]);
    setNewLobby({
      name: '',
      maxPlayers: 8,
      hasPassword: false,
      password: '',
      description: '',
      tags: []
    });
    setShowCreateLobby(false);
    setActiveTab('myLobbies');
  };

  const quickJoinLobby = () => {
    if (!quickJoinData.lobbyId || quickJoinData.lobbyId.length !== 8) {
      alert("Please enter a valid 8-digit lobby ID");
      return;
    }
    
    if (quickJoinData.hasPassword && !quickJoinData.password) {
      alert("Please enter the lobby password");
      return;
    }
    
    // Find lobby by ID (in real app, this would be an API call)
    const lobby = lobbies.find(l => l.id.toString() === quickJoinData.lobbyId);
    
    if (!lobby) {
      alert("Lobby not found. Please check the ID and try again.");
      return;
    }
    
    if (lobby.hasPassword && lobby.hasPassword !== quickJoinData.hasPassword) {
      alert("Password requirement mismatch for this lobby");
      return;
    }
    
    // Add to my lobbies
    setMyLobbies(prev => [...prev, {
      id: lobby.id,
      name: lobby.name,
      role: "Player",
      status: "Active",
      players: lobby.players + 1,
      maxPlayers: lobby.maxPlayers
    }]);
    
    setQuickJoinData({
      lobbyId: '',
      hasPassword: false,
      password: ''
    });
    setShowQuickJoin(false);
    setActiveTab('myLobbies');
    alert(`Successfully joined lobby: ${lobby.name}`);
  };

  const joinLobby = (lobby) => {
    if (lobby.hasPassword) {
      const password = prompt("Enter lobby password:");
      if (!password) return;
    }
    
    // Add to my lobbies
    setMyLobbies(prev => [...prev, {
      id: lobby.id,
      name: lobby.name,
      role: "Player",
      status: "Active",
      players: lobby.players + 1,
      maxPlayers: lobby.maxPlayers
    }]);
    
    alert(`Joined lobby: ${lobby.name}`);
  };

  const LobbyCard = ({ lobby }) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{lobby.name}</h3>
            {lobby.hasPassword ? (
              <Lock className="w-4 h-4 text-amber-500" />
            ) : (
              <Unlock className="w-4 h-4 text-green-500" />
            )}
            <div className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${lobby.isOnline ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-xs text-gray-500">{lobby.isOnline ? 'Online' : 'Offline'}</span>
            </div>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
            Host: <span className="font-medium">{lobby.host}</span>
          </p>
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">{lobby.description}</p>
        </div>
        <button
          onClick={() => toggleSavedLobby(lobby.id)}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          {savedLobbies.includes(lobby.id) ? (
            <Star className="w-5 h-5 text-yellow-500 fill-current" />
          ) : (
            <StarOff className="w-5 h-5 text-gray-400" />
          )}
        </button>
      </div>
      
      <div className="flex flex-wrap gap-2 mb-4">
        {lobby.tags.map((tag, index) => (
          <span
            key={index}
            className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs rounded-full"
          >
            {tag}
          </span>
        ))}
      </div>
      
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            <span>{lobby.players}/{lobby.maxPlayers}</span>
          </div>
          <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
            ID: {lobby.id}
          </span>
        </div>
        <span className="text-xs text-gray-500">{lobby.createdAt}</span>
      </div>
      
      <div className="flex gap-2">
        <button
          onClick={() => joinLobby(lobby)}
          disabled={lobby.players >= lobby.maxPlayers}
          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          {lobby.players >= lobby.maxPlayers ? 'Full' : 'Join'}
        </button>
        <button className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
          View
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Enhanced Header Section */}
        <div className="relative mb-12">
          {/* Back Button */}
          <button
            onClick={() => navigate('/dashboard')}
            className="absolute left-0 top-0 flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors group"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="font-medium">Back to Dashboard</span>
          </button>

          {/* Main Header Content */}
          <div className="text-center pt-12">
            {/* Game Icon and Title */}
            <div className="flex justify-center items-center gap-4 mb-6">
              <div className="relative">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <Building2 className="w-8 h-8 text-white" />
                </div>
                <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                  <Play className="w-3 h-3 text-white fill-current" />
                </div>
              </div>
              <div className="text-left">
                <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent mb-1">
                  Campus Simulator
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium tracking-wide">
                  MULTIPLAYER CAMPUS SIMULATION GAME
                </p>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="flex justify-center gap-8 text-center mb-8">
              <div>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{lobbies.length}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Active Lobbies</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {lobbies.reduce((sum, lobby) => sum + lobby.players, 0)}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Players Online</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{myLobbies.length}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">My Lobbies</div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex justify-center mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-1 shadow-md">
            <button
              onClick={() => setActiveTab('browse')}
              className={`px-6 py-2 rounded-md font-medium transition-colors ${
                activeTab === 'browse'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              Browse Lobbies
            </button>
            <button
              onClick={() => setActiveTab('myLobbies')}
              className={`px-6 py-2 rounded-md font-medium transition-colors ${
                activeTab === 'myLobbies'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              My Lobbies ({myLobbies.length})
            </button>
            <button
              onClick={() => setActiveTab('saved')}
              className={`px-6 py-2 rounded-md font-medium transition-colors ${
                activeTab === 'saved'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              Saved Lobbies ({savedLobbies.length})
            </button>
          </div>
        </div>

        {/* Browse Lobbies Tab */}
        {activeTab === 'browse' && (
          <div className="space-y-6">
            {/* Search and Create */}
            <div className="flex gap-4 items-center">
              <div className="flex-1 relative">
                <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search lobbies, hosts, or descriptions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={() => setShowQuickJoin(true)}
                className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-colors"
              >
                <Zap className="w-5 h-5" />
                Quick Join
              </button>
              <button
                onClick={() => setShowCreateLobby(true)}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Create Lobby
              </button>
              <button
                onClick={() => setFilterOpen(!filterOpen)}
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-3 rounded-lg transition-colors"
              >
                <Filter className="w-5 h-5" />
              </button>
              <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg transition-colors">
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>

            {/* Filters */}
            {filterOpen && (
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Access Type
                    </label>
                    <select
                      value={passwordFilter}
                      onChange={(e) => setPasswordFilter(e.target.value)}
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="all">All Lobbies</option>
                      <option value="public">Public Only</option>
                      <option value="private">Private Only</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Player Count
                    </label>
                    <select
                      value={playerCountFilter}
                      onChange={(e) => setPlayerCountFilter(e.target.value)}
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="all">Any Size</option>
                      <option value="low">1-4 Players</option>
                      <option value="medium">5-8 Players</option>
                      <option value="high">9+ Players</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Sort By
                    </label>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="players">Player Count</option>
                      <option value="name">Lobby Name</option>
                      <option value="created">Recently Created</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Lobbies Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredLobbies.map(lobby => (
                <LobbyCard key={lobby.id} lobby={lobby} />
              ))}
            </div>

            {filteredLobbies.length === 0 && (
              <div className="text-center py-12">
                <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No lobbies found</h3>
                <p className="text-gray-600 dark:text-gray-400">Try adjusting your search or filters</p>
              </div>
            )}
          </div>
        )}

        {/* My Lobbies Tab */}
        {activeTab === 'myLobbies' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">My Lobbies</h2>
              <button
                onClick={() => setShowCreateLobby(true)}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Create New
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {myLobbies.map(lobby => (
                <div key={lobby.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{lobby.name}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        Role: <span className="font-medium text-blue-600">{lobby.role}</span>
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      lobby.status === 'Active' 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                    }`}>
                      {lobby.status}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 mb-4">
                    <Users className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {lobby.players}/{lobby.maxPlayers} players
                    </span>
                  </div>
                  
                  <div className="flex gap-2">
                    <button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
                      Join Game
                    </button>
                    {lobby.role === 'Host' && (
                      <button className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        <Settings className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {myLobbies.length === 0 && (
              <div className="text-center py-12">
                <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No active lobbies</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">Create or join a lobby to start playing</p>
                <button
                  onClick={() => setShowCreateLobby(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium"
                >
                  Create Your First Lobby
                </button>
              </div>
            )}
          </div>
        )}

        {/* Saved Lobbies Tab */}
        {activeTab === 'saved' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Saved Lobbies</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {lobbies.filter(lobby => savedLobbies.includes(lobby.id)).map(lobby => (
                <LobbyCard key={lobby.id} lobby={lobby} />
              ))}
            </div>

            {savedLobbies.length === 0 && (
              <div className="text-center py-12">
                <Star className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No saved lobbies</h3>
                <p className="text-gray-600 dark:text-gray-400">Star lobbies to save them for later</p>
              </div>
            )}
          </div>
        )}

        {/* Create Lobby Modal */}
        {showCreateLobby && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Create New Lobby</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Lobby Name*
                  </label>
                  <input
                    type="text"
                    value={newLobby.name}
                    onChange={(e) => setNewLobby({...newLobby, name: e.target.value})}
                    placeholder="Enter lobby name"
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Max Players
                  </label>
                  <select
                    value={newLobby.maxPlayers}
                    onChange={(e) => setNewLobby({...newLobby, maxPlayers: parseInt(e.target.value)})}
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value={4}>4 Players</option>
                    <option value={8}>8 Players</option>
                    <option value={12}>12 Players</option>
                    <option value={16}>16 Players</option>
                    <option value={20}>20 Players</option>
                  </select>
                </div>

                <div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={newLobby.hasPassword}
                      onChange={(e) => setNewLobby({...newLobby, hasPassword: e.target.checked})}
                      className="rounded"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Private lobby (requires password)
                    </span>
                  </label>
                </div>

                {newLobby.hasPassword && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Password
                    </label>
                    <input
                      type="password"
                      value={newLobby.password}
                      onChange={(e) => setNewLobby({...newLobby, password: e.target.value})}
                      placeholder="Enter password"
                      className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={newLobby.description}
                    onChange={(e) => setNewLobby({...newLobby, description: e.target.value})}
                    placeholder="Describe your lobby..."
                    rows={3}
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowCreateLobby(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={createLobby}
                  disabled={!newLobby.name.trim()}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Create Lobby
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Quick Join Modal */}
        {showQuickJoin && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Quick Join Lobby</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Lobby ID*
                  </label>
                  <input
                    type="text"
                    value={quickJoinData.lobbyId}
                    onChange={(e) => {
                      // Only allow numbers and limit to 8 digits
                      const value = e.target.value.replace(/\D/g, '').slice(0, 8);
                      setQuickJoinData({...quickJoinData, lobbyId: value});
                    }}
                    placeholder="Enter 8-digit lobby ID"
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-center text-lg tracking-wider"
                    maxLength={8}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Enter the 8-digit lobby ID (e.g., 12345678)
                  </p>
                </div>

                <div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={quickJoinData.hasPassword}
                      onChange={(e) => setQuickJoinData({...quickJoinData, hasPassword: e.target.checked, password: ''})}
                      className="rounded"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      This lobby requires a password
                    </span>
                  </label>
                </div>

                {quickJoinData.hasPassword && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Password
                    </label>
                    <input
                      type="password"
                      value={quickJoinData.password}
                      onChange={(e) => setQuickJoinData({...quickJoinData, password: e.target.value})}
                      placeholder="Enter lobby password"
                      className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowQuickJoin(false);
                    setQuickJoinData({
                      lobbyId: '',
                      hasPassword: false,
                      password: ''
                    });
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={quickJoinLobby}
                  disabled={!quickJoinData.lobbyId || quickJoinData.lobbyId.length !== 8}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Zap className="w-4 h-4" />
                  Join Lobby
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CampusSimulator;
