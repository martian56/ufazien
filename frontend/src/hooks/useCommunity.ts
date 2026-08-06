import { useState, useEffect, useCallback } from 'react';
import type {
  ChatMessage,
  CommunityStats,
  Forum,
  ForumPost,
  Group,
  PrivateChat,
} from "../lib/api/endpoints/community"
import { communityApi as communityAPI } from '../lib/api/endpoints/community';
import { errorMessage } from '../lib/api/errors';

/** Scalars only: these go into a query string. */
type QueryParams = Record<string, string | number | boolean | null | undefined>;
import { communityWS } from '../services/websocket';

/** These endpoints answer with either a page or a plain list. */
function rows<T>(response: { results?: T[] } | T[] | null | undefined): T[] {
  if (Array.isArray(response)) return response
  return response?.results ?? []
}

interface ChatConnection {
  send: (message: string) => boolean
  sendTyping: () => boolean
  sendStopTyping: () => boolean
  disconnect: () => void
  isConnected: () => boolean | undefined
  /** Private chats only. */
  markRead?: () => void
}

export const useCommunityData = () => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [forums, setForums] = useState<Forum[]>([]);
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [chats, setChats] = useState<PrivateChat[]>([]);
  const [stats, setStats] = useState<CommunityStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load initial data

  const loadGroups = useCallback(async (params: QueryParams = {}) => {
    try {
      setError(null);
      const response = await communityAPI.getGroups(params);
      setGroups(rows(response));
    } catch (err) {
      setError(errorMessage(err, 'Could not load that right now.'));
    }
  }, []);

  const loadForums = useCallback(async (params: QueryParams = {}) => {
    try {
      setError(null);
      const response = await communityAPI.getForums(params);
      setForums(rows(response));
    } catch (err) {
      setError(errorMessage(err, 'Could not load that right now.'));
    }
  }, []);

  const loadPosts = useCallback(async (params: QueryParams = {}) => {
    try {
      setError(null);
      const response = await communityAPI.getPosts(params);
      setPosts(rows(response));
    } catch (err) {
      setError(errorMessage(err, 'Could not load that right now.'));
    }
  }, []);

  // Load all data together
  const loadAllData = useCallback(async () => {
    
    try {
      setLoading(true);
      setError(null);
      
      
      // Load all data in parallel
      await Promise.all([
        loadGroups(),
        loadForums(), 
        loadPosts(),
        loadChats(),
        loadStats()
      ]);
      
    } catch (err) {
      setError(errorMessage(err, 'Could not load the community right now.'));
      
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
    }
  }, []);

  const loadChats = useCallback(async () => {
    try {
      setLoading(true);
      const response = await communityAPI.getChats();
      setChats(rows(response));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // Group operations
  const joinGroup = useCallback(async (groupId: string) => {
    try {
      const updatedGroup = await communityAPI.joinGroup(groupId);
      setGroups(prevGroups => 
        prevGroups.map(group => 
          group.id === groupId ? updatedGroup : group
        )
      );
      return updatedGroup;
    } catch (err) {
      setError(errorMessage(err));
      throw err;
    }
  }, []);

  const leaveGroup = useCallback(async (groupId: string) => {
    try {
      const updatedGroup = await communityAPI.leaveGroup(groupId);
      setGroups(prevGroups => 
        prevGroups.map(group => 
          group.id === groupId ? updatedGroup : group
        )
      );
      return updatedGroup;
    } catch (err) {
      setError(errorMessage(err));
      throw err;
    }
  }, []);

  const createGroup = useCallback(async (groupData: Record<string, unknown>) => {
    try {
      const newGroup = await communityAPI.createGroup(groupData);
      setGroups(prevGroups => [newGroup, ...prevGroups]);
      return newGroup;
    } catch (err) {
      setError(errorMessage(err));
      throw err;
    }
  }, []);

  const createForum = useCallback(async (forumData: Record<string, unknown>) => {
    try {
      const newForum = await communityAPI.createForum(forumData);
      setForums(prevForums => [newForum, ...prevForums]);
      return newForum;
    } catch (err) {
      setError(errorMessage(err));
      throw err;
    }
  }, []);

  // Post operations
  const likePost = useCallback(async (postId: string) => {
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
      setError(errorMessage(err));
      throw err;
    }
  }, []);

  const bookmarkPost = useCallback(async (postId: string) => {
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
      setError(errorMessage(err));
      throw err;
    }
  }, []);

  const createPost = useCallback(async (postData: Record<string, unknown>) => {
    try {
      const newPost = await communityAPI.createPost(postData);
      setPosts(prevPosts => [newPost, ...prevPosts]);
      return newPost;
    } catch (err) {
      setError(errorMessage(err));
      throw err;
    }
  }, []);

  const createChat = useCallback(async (chatData: { participant_ids: number[]; name?: string | null; is_group_chat?: boolean }) => {
    try {
      const newChat = await communityAPI.createChat(chatData);
      setChats(prevChats => [newChat, ...prevChats]);
      return newChat;
    } catch (err) {
      setError(errorMessage(err));
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

export const useGroupChat = (groupId: string | null) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // communityWS hands back its own wrapper, not a raw WebSocket.
  const [connection, setConnection] = useState<ChatConnection | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState(new Set());

  useEffect(() => {
    if (!groupId) return;

    // Load existing messages
    const loadMessages = async () => {
      try {
        const response = await communityAPI.getGroupMessages(groupId);
        setMessages(rows(response));
      } catch (error) {
        setChatError(errorMessage(error, 'Could not load those messages.'));
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
        const systemMessage: ChatMessage = {
          id: `system_${Date.now()}`,
          sender: { id: 0, username: 'System', email: null },
          content: `${data.username} joined the chat`,
          message_type: 'system',
          created_at: data.timestamp,
        };
        setMessages(prev => [...prev, systemMessage]);
      },
      user_left: (data) => {
        const systemMessage: ChatMessage = {
          id: `system_${Date.now()}`,
          sender: { id: 0, username: 'System', email: null },
          content: `${data.username} left the chat`,
          message_type: 'system',
          created_at: data.timestamp
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

  const sendMessage = useCallback((content: string) => {
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

export const usePrivateChat = (chatId: string | null) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // communityWS hands back its own wrapper, not a raw WebSocket.
  const [connection, setConnection] = useState<ChatConnection | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState(new Set());

  useEffect(() => {
    if (!chatId) return;

    // Load existing messages
    const loadMessages = async () => {
      try {
        const response = await communityAPI.getChatMessages(chatId);
        setMessages(rows(response));
      } catch (error) {
        setChatError(errorMessage(error, 'Could not load those messages.'));
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

  const sendMessage = useCallback((content: string) => {
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
    // Group connections have no markRead; only private chats do.
    connection?.markRead?.();
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
