import { useState, useEffect, useCallback } from 'react';
import { communityApi as communityAPI } from '../lib/api/endpoints/community';
import { communityWS } from '../services/websocket';

export const useCommunityData = () => {
  const [groups, setGroups] = useState([]);
  const [forums, setForums] = useState([]);
  const [posts, setPosts] = useState([]);
  const [chats, setChats] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load initial data
  const loadGroups = useCallback(async (params = {}) => {
    try {
      setError(null);
      const response = await communityAPI.getGroups(params);
      setGroups(response.results || response);
    } catch (err) {
      console.error('❌ Error loading groups:', err);
      console.error('❌ Error details:', {
        message: err.message,
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data
      });
      setError(err.message);
    }
  }, []);

  const loadForums = useCallback(async (params = {}) => {
    try {
      setError(null);
      const response = await communityAPI.getForums(params);
      setForums(response.results || response);
    } catch (err) {
      console.error('❌ Error loading forums:', err);
      console.error('❌ Error details:', {
        message: err.message,
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data
      });
      setError(err.message);
    }
  }, []);

  const loadPosts = useCallback(async (params = {}) => {
    try {
      setError(null);
      const response = await communityAPI.getPosts(params);
      setPosts(response.results || response);
    } catch (err) {
      console.error('❌ Error loading posts:', err);
      console.error('❌ Error details:', {
        message: err.message,
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data
      });
      setError(err.message);
    }
  }, []);

  // Load all data together
  const loadAllData = useCallback(async () => {
    
    try {
      setLoading(true);
      setError(null);
      
      
      // Load all data in parallel
      const startTime = Date.now();
      await Promise.all([
        loadGroups(),
        loadForums(), 
        loadPosts(),
        loadChats(),
        loadStats()
      ]);
      
      const endTime = Date.now();
      
    } catch (err) {
      console.error('💥 Critical error in loadAllData:', err);
      console.error('💥 Error stack:', err.stack);
      setError(err.message);
      
      // No mock fallback. Showing invented groups and posts hid real API
      // failures from users and from us; the page renders an error state.
      setGroups([]);
      setForums([]);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [loadGroups, loadForums, loadPosts, groups.length, forums.length, posts.length, loading, error]);

  // The sidebar used to count the loaded page: "Posts Liked" meant liked posts
  // visible right now, not the user's total. The API already computes these.
  const loadStats = useCallback(async () => {
    try {
      const response = await communityAPI.getCommunityStats();
      setStats(response);
    } catch (err) {
      console.error('Error loading community stats:', err);
    }
  }, []);

  const loadChats = useCallback(async () => {
    try {
      setLoading(true);
      const response = await communityAPI.getChats();
      setChats(response.results || response);
    } catch (err) {
      setError(err.message);
      console.error('Error loading chats:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Group operations
  const joinGroup = useCallback(async (groupId) => {
    try {
      const updatedGroup = await communityAPI.joinGroup(groupId);
      setGroups(prevGroups => 
        prevGroups.map(group => 
          group.id === groupId ? updatedGroup : group
        )
      );
      return updatedGroup;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const leaveGroup = useCallback(async (groupId) => {
    try {
      const updatedGroup = await communityAPI.leaveGroup(groupId);
      setGroups(prevGroups => 
        prevGroups.map(group => 
          group.id === groupId ? updatedGroup : group
        )
      );
      return updatedGroup;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const createGroup = useCallback(async (groupData) => {
    try {
      const newGroup = await communityAPI.createGroup(groupData);
      setGroups(prevGroups => [newGroup, ...prevGroups]);
      return newGroup;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const createForum = useCallback(async (forumData) => {
    try {
      const newForum = await communityAPI.createForum(forumData);
      setForums(prevForums => [newForum, ...prevForums]);
      return newForum;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  // Post operations
  const likePost = useCallback(async (postId) => {
    try {
      const result = await communityAPI.likePost(postId);
      setPosts(prevPosts => 
        prevPosts.map(post => 
          post.id === postId 
            ? { ...post, is_liked: result.liked, like_count: result.like_count }
            : post
        )
      );
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const bookmarkPost = useCallback(async (postId) => {
    try {
      const result = await communityAPI.bookmarkPost(postId);
      setPosts(prevPosts => 
        prevPosts.map(post => 
          post.id === postId 
            ? { ...post, is_bookmarked: result.bookmarked }
            : post
        )
      );
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const createPost = useCallback(async (postData) => {
    try {
      const newPost = await communityAPI.createPost(postData);
      setPosts(prevPosts => [newPost, ...prevPosts]);
      return newPost;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const createChat = useCallback(async (chatData) => {
    try {
      const newChat = await communityAPI.createChat(chatData);
      setChats(prevChats => [newChat, ...prevChats]);
      return newChat;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  return {
    // Data
    groups,
    forums,
    posts,
    chats,
    stats,
    loading,
    error,
    
    // Loaders
    loadGroups,
    loadForums,
    loadPosts,
    loadChats,
    loadStats,
    loadAllData,
    
    // Group operations
    joinGroup,
    leaveGroup,
    createGroup,
    createForum,
    
    // Post operations
    likePost,
    bookmarkPost,
    createPost,
    
    // Chat operations
    createChat,
    
    // Setters for direct updates
    setGroups,
    setForums,
    setPosts,
    setChats,
    setError
  };
};

export const useGroupChat = (groupId) => {
  const [messages, setMessages] = useState([]);
  const [connection, setConnection] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState(new Set());

  useEffect(() => {
    if (!groupId) return;

    // Load existing messages
    const loadMessages = async () => {
      try {
        const response = await communityAPI.getGroupMessages(groupId);
        setMessages(response.results || response);
      } catch (error) {
        console.error('Error loading messages:', error);
      }
    };

    loadMessages();

    // Set up WebSocket connection
    const wsConnection = communityWS.connectToGroupChat(groupId, {
      connected: () => setIsConnected(true),
      disconnected: () => setIsConnected(false),
      message: (data) => {
        if (data.message) {
          setMessages(prev => [...prev, data.message]);
        }
      },
      user_joined: (data) => {
        const systemMessage = {
          id: `system_${Date.now()}`,
          sender: { username: 'System' },
          content: `${data.username} joined the chat`,
          message_type: 'system',
          timestamp: data.timestamp
        };
        setMessages(prev => [...prev, systemMessage]);
      },
      user_left: (data) => {
        const systemMessage = {
          id: `system_${Date.now()}`,
          sender: { username: 'System' },
          content: `${data.username} left the chat`,
          message_type: 'system',
          timestamp: data.timestamp
        };
        setMessages(prev => [...prev, systemMessage]);
      },
      typing: (data) => {
        setTypingUsers(prev => new Set([...prev, data.username]));
        // Remove typing indicator after 3 seconds
        setTimeout(() => {
          setTypingUsers(prev => {
            const newSet = new Set(prev);
            newSet.delete(data.username);
            return newSet;
          });
        }, 3000);
      },
      stop_typing: (data) => {
        setTypingUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(data.username);
          return newSet;
        });
      }
    });

    setConnection(wsConnection);

    return () => {
      wsConnection.disconnect();
    };
  }, [groupId]);

  const sendMessage = useCallback((content) => {
    if (connection && content.trim()) {
      return connection.send(content.trim());
    }
    return false;
  }, [connection]);

  const sendTyping = useCallback(() => {
    if (connection) {
      connection.sendTyping();
    }
  }, [connection]);

  const sendStopTyping = useCallback(() => {
    if (connection) {
      connection.sendStopTyping();
    }
  }, [connection]);

  return {
    messages,
    isConnected,
    typingUsers: Array.from(typingUsers),
    sendMessage,
    sendTyping,
    sendStopTyping
  };
};

export const usePrivateChat = (chatId) => {
  const [messages, setMessages] = useState([]);
  const [connection, setConnection] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState(new Set());

  useEffect(() => {
    if (!chatId) return;

    // Load existing messages
    const loadMessages = async () => {
      try {
        const response = await communityAPI.getChatMessages(chatId);
        setMessages(response.results || response);
      } catch (error) {
        console.error('Error loading messages:', error);
      }
    };

    loadMessages();

    // Set up WebSocket connection
    const wsConnection = communityWS.connectToPrivateChat(chatId, {
      connected: () => setIsConnected(true),
      disconnected: () => setIsConnected(false),
      message: (data) => {
        if (data.message) {
          setMessages(prev => [...prev, data.message]);
        }
      },
      typing: (data) => {
        setTypingUsers(prev => new Set([...prev, data.username]));
        setTimeout(() => {
          setTypingUsers(prev => {
            const newSet = new Set(prev);
            newSet.delete(data.username);
            return newSet;
          });
        }, 3000);
      },
      stop_typing: (data) => {
        setTypingUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(data.username);
          return newSet;
        });
      }
    });

    setConnection(wsConnection);

    return () => {
      wsConnection.disconnect();
    };
  }, [chatId]);

  const sendMessage = useCallback((content) => {
    if (connection && content.trim()) {
      return connection.send(content.trim());
    }
    return false;
  }, [connection]);

  const sendTyping = useCallback(() => {
    if (connection) {
      connection.sendTyping();
    }
  }, [connection]);

  const sendStopTyping = useCallback(() => {
    if (connection) {
      connection.sendStopTyping();
    }
  }, [connection]);

  const markAsRead = useCallback(() => {
    if (connection) {
      connection.markRead();
    }
  }, [connection]);

  return {
    messages,
    isConnected,
    typingUsers: Array.from(typingUsers),
    sendMessage,
    sendTyping,
    sendStopTyping,
    markAsRead
  };
};
