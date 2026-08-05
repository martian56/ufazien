"use client"

import { useState, useEffect, useRef } from "react"
import { Helmet } from "react-helmet"
import { useNavigate, useSearchParams } from "react-router-dom"
import RichTextEditor from "../../../components/RichTextEditor"
import "../../../components/RichTextEditor.css"
import "../../../components/BlogContent.css"
import { sanitizeText, sanitizeHtml, apiRateLimiter } from "../../../utils/security"
import { useDraft } from "../../../features/blog/useDraft"
import { blogApi } from "../../../lib/api/endpoints/blog"
import { api } from "../../../lib/api/client"
import { toList } from "../../../lib/api/types"
import { logger } from "../../../lib/logger"
import { enhanceBlogContent } from "../../../utils/blogContentEnhancer"
import { useToast, ToastContainer } from "../../../hooks/useToast"
import {
  Save,
  Eye,
  Send,
  ImageIcon,
  Link,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Quote,
  Code,
  Heading1,
  Heading2,
  Heading3,
  FileText,
  Users,
  Sparkles,
  Zap,
  BookOpen,
  Target,
  TrendingUp,
  Search,
  X,
  Plus,
  Clock,
  Settings,
  Moon,
  Sun,
  Volume2,
  VolumeX,
  Play,
  Pause,
  RotateCcw,
  Maximize,
  Minimize,
  Award,
  Trophy,
  Lightbulb,
  Rocket,
  ChevronLeft
} from "lucide-react"


const BlogCreate = () => {
  const { notifications: toastNotifications, toast, removeNotification } = useToast();
  const navigate = useNavigate()
  // Core state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [tags, setTags] = useState([]);
  const [category, setCategory] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [publishDate, setPublishDate] = useState('');
  const [featuredImage, setFeaturedImage] = useState('');
  const [isDraft, setIsDraft] = useState(true);
  const [isPreview, setIsPreview] = useState(false);

  // API state
  const [categories, setCategories] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [tagSuggestions, setTagSuggestions] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  // Advanced features state
  const [wordCount, setWordCount] = useState(0);
  const [readingTime, setReadingTime] = useState(0);
  const [seoScore, setSeoScore] = useState(0);
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [writingGoal, setWritingGoal] = useState(500);
  const [writingProgress, setWritingProgress] = useState(0);
  const [focusMode, setFocusMode] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [autoSave, setAutoSave] = useState(true);
  const [lastSaved, setLastSaved] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [typingTimer, setTypingTimer] = useState(null);

  // Editor state
  const [selectedText, setSelectedText] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [fontSize, setFontSize] = useState(16);
  const [fontFamily, setFontFamily] = useState('Inter');
  const [lineHeight, setLineHeight] = useState(1.6);

  // Productivity features
  const [pomodoroActive, setPomodoroActive] = useState(false);
  const [pomodoroTime, setPomodoroTime] = useState(25 * 60);
  const [breakTime, setBreakTime] = useState(5 * 60);
  const [currentTimer, setCurrentTimer] = useState(pomodoroTime);
  const [isBreak, setIsBreak] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [backgroundMusic, setBackgroundMusic] = useState(false);
  const [distractionBlocker, setDistractionBlocker] = useState(false);

  // Analytics and insights
  const [writingStreak, setWritingStreak] = useState(0);
  const [dailyGoal, setDailyGoal] = useState(1000);
  const [weeklyStats, setWeeklyStats] = useState({});
  const [writingHabits, setWritingHabits] = useState({});
  const [bestWritingTime, setBestWritingTime] = useState('');

  // Collaboration features
  const [collaborators, setCollaborators] = useState([]);
  const [comments, setComments] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [reviewMode, setReviewMode] = useState(false);

  // Templates and snippets
  const [templates, setTemplates] = useState([]);
  const [snippets, setSnippets] = useState([]);
  const [customSnippets, setCustomSnippets] = useState([]);

  // References
  const editorRef = useRef(null);
  const timerRef = useRef(null);
  const autoSaveRef = useRef(null);
  const previewRef = useRef(null);

  // Enhancement effect for preview content
  useEffect(() => {
    if (previewRef.current && isPreview && content) {
      enhanceBlogContent(previewRef.current);
    }
  }, [isPreview, content]);



  // Writing templates
  const blogTemplates = [
    {
      id: 'academic-paper',
      name: 'Academic Paper Review',
      content: `<h1>Paper Title Review</h1>

<h2>Abstract Summary</h2>
<p>Brief overview of the paper's main contributions...</p>

<h2>Key Findings</h2>
<ol>
  <li>First major finding</li>
  <li>Second major finding</li>
  <li>Third major finding</li>
</ol>

<h2>Methodology</h2>
<p>Description of the research methodology...</p>

<h2>Critical Analysis</h2>
<p>Your analysis and critique...</p>

<h2>Conclusion</h2>
<p>Summary of your thoughts and recommendations...</p>

<h2>References</h2>
<ul>
  <li>Reference 1</li>
  <li>Reference 2</li>
</ul>`
    },
    {
      id: 'project-showcase',
      name: 'Project Showcase',
      content: `<h1>Project Name</h1>

<h2>Overview</h2>
<p>Brief description of your project...</p>

<h2>Problem Statement</h2>
<p>What problem does this project solve?</p>

<h2>Solution</h2>
<p>How did you approach the problem?</p>

<h2>Technologies Used</h2>
<ul>
  <li>Technology 1</li>
  <li>Technology 2</li>
  <li>Technology 3</li>
</ul>

<h2>Implementation</h2>
<p>Step-by-step implementation details...</p>

<h2>Results</h2>
<p>What were the outcomes?</p>

<h2>Challenges & Learnings</h2>
<p>What did you learn from this project?</p>

<h2>Future Improvements</h2>
<p>What would you do differently next time?</p>

<h2>Demo</h2>
<p><a href="#">Link to live demo or repository</a></p>`
    },
    {
      id: 'tutorial',
      name: 'Tutorial Guide',
      content: `<h1>How to [Tutorial Topic]</h1>

<h2>Introduction</h2>
<p>What will readers learn from this tutorial?</p>

<h2>Prerequisites</h2>
<p>What do readers need to know before starting?</p>

<h2>Step 1: [First Step]</h2>
<p>Detailed explanation...</p>

<h2>Step 2: [Second Step]</h2>
<p>Detailed explanation...</p>

<h2>Step 3: [Third Step]</h2>
<p>Detailed explanation...</p>

<h2>Common Issues</h2>
<p>Troubleshooting common problems...</p>

<h2>Conclusion</h2>
<p>Summary and next steps...</p>

<h2>Additional Resources</h2>
<ul>
  <li>Resource 1</li>
  <li>Resource 2</li>
</ul>`
    }
  ];

  // AI writing suggestions
  const aiWritingTips = [
    "Consider adding more specific examples to support your main points",
    "Your introduction could be more engaging with a compelling hook",
    "Try varying your sentence structure for better readability",
    "Consider adding subheadings to break up long sections",
    "Your conclusion could include a call-to-action for readers",
    "Adding relevant statistics could strengthen your arguments",
    "Consider including personal anecdotes to connect with readers",
    "Your paragraphs could be shorter for better mobile readability"
  ];

  // Calculate word count and reading time
  useEffect(() => {
    // Remove HTML tags for word count calculation
    const textContent = content.replace(/<[^>]*>/g, '').trim();
    const words = textContent.split(/\s+/).filter(word => word.length > 0).length;
    setWordCount(words);
    const minutes = Math.ceil(words / 200); // Average reading speed
    setReadingTime(minutes);
    setWritingProgress((words / writingGoal) * 100);
    
    // Calculate SEO score (simplified)
    let score = 0;
    if (title.length > 30 && title.length < 60) score += 20;
    if (excerpt.length > 120 && excerpt.length < 160) score += 20;
    if (words > 300) score += 20;
    if (tags.length >= 3 && tags.length <= 8) score += 20;
    if (textContent.toLowerCase().includes(title.toLowerCase())) score += 20;
    setSeoScore(score);
  }, [content, title, excerpt, tags, writingGoal]);

  // API Integration
  useEffect(() => {
    fetchCategories();
    fetchTags();
  }, []);

  const fetchCategories = async () => {
    setIsLoadingCategories(true);
    try {
      setCategories(toList(await blogApi.categories()));
    } catch (error) {
      logger.error('Error fetching categories:', error);
    } finally {
      setIsLoadingCategories(false);
    }
  };

  const fetchTags = async () => {
    setIsLoadingTags(true);
    try {
      setAvailableTags(toList(await blogApi.tags()));
    } catch (error) {
      logger.error('Error fetching tags:', error);
    } finally {
      setIsLoadingTags(false);
    }
  };

  const searchTags = async (query) => {
    if (!query.trim()) {
      setTagSuggestions([]);
      return;
    }

    try {
      setTagSuggestions(toList(await api.get('/blog/tags/', { params: { search: query } })));
    } catch (error) {
      logger.error('Error searching tags:', error);
      setTagSuggestions([]);
    }
  };

  const createTag = async (tagName) => {
    try {
      return await api.post('/blog/tags/', { name: tagName });
    } catch (error) {
      logger.error('Error creating tag:', error);
      return null;
    }
  };

  // Auto-save functionality
  useEffect(() => {
    if (autoSave && (title || content)) {
      if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
      autoSaveRef.current = setTimeout(() => {
        handleAutoSave();
      }, 2000);
    }
    return () => {
      if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    };
  }, [title, content, autoSave]);

  // Pomodoro timer
  useEffect(() => {
    if (pomodoroActive) {
      timerRef.current = setInterval(() => {
        setCurrentTimer(prev => {
          if (prev <= 1) {
            if (soundEnabled) {
              // Play notification sound
              const audio = new Audio('/notification.mp3');
              audio.play().catch(() => {});
            }
            
            if (isBreak) {
              setIsBreak(false);
              return pomodoroTime;
            } else {
              setIsBreak(true);
              return breakTime;
            }
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [pomodoroActive, isBreak, pomodoroTime, breakTime, soundEnabled]);

  // Typing indicator
  useEffect(() => {
    if (content) {
      setIsTyping(true);
      if (typingTimer) clearTimeout(typingTimer);
      setTypingTimer(setTimeout(() => setIsTyping(false), 1000));
    }
  }, [content]);

  // The draft as the API wants it. Sanitised here so a draft is stored the
  // same way a published post is.
  const draftPayload = () => ({
    title: sanitizeText(title, 200) || 'Untitled draft',
    content: sanitizeHtml(content),
    excerpt: sanitizeText(excerpt, 300),
    category: category ? parseInt(category, 10) : null,
    tag_names: tags.map((tag) => sanitizeText(tag, 50)).filter(Boolean),
    read_time: String(calculateReadTime(content) || 1),
  });

  // Was localStorage under the single key "blog-draft": one draft for the
  // whole account, never sent anywhere, gone on another device or a cleared
  // browser. Drafts are real posts now, saved unpublished.
  const [searchParams] = useSearchParams();
  const resumingDraftId = searchParams.get('draft');
  const {
    postId: draftPostId,
    lastSaved: draftLastSaved,
    save: saveDraft,
    scheduleSave: scheduleDraftSave,
    publish: publishDraft,
  } = useDraft(resumingDraftId);

  // Resuming: load what was written last time.
  useEffect(() => {
    if (!resumingDraftId) return;
    let active = true;
    blogApi
      .get(resumingDraftId)
      .then((post) => {
        if (!active) return;
        setTitle(post.title === 'Untitled draft' ? '' : post.title);
        setContent(post.content || '');
        setExcerpt(post.excerpt || '');
        if (post.category?.id) setCategory(String(post.category.id));
        if (Array.isArray(post.tags)) setTags(post.tags.map((t) => (typeof t === 'string' ? t : t.name)));
      })
      .catch(() => toast.error('Could not open that draft.'));
    return () => {
      active = false;
    };
  }, [resumingDraftId]);

  const handleAutoSave = () => {
    if (!title.trim() && !content.trim()) return;
    scheduleDraftSave(draftPayload());
  };

  const handleSave = async () => {
    if (!title.trim() && !content.trim()) {
      toast.error('Write something before saving a draft.');
      return;
    }
    const saved = await saveDraft(draftPayload());
    if (saved) toast.success('Draft saved. You can finish it later.');
  };

  const handlePublish = async () => {
    // Sanitize and validate inputs
    const sanitizedTitle = sanitizeText(title, 200)
    
    // Debug: Log the content before and after sanitization
    const sanitizedContent = sanitizeHtml(content)
    
    const sanitizedExcerpt = sanitizeText(excerpt, 300)

    if (!sanitizedTitle.trim() || !sanitizedContent.trim()) {
      toast.error('Please add a title and content before publishing.');
      return;
    }

    if (!category) {
      toast.error('Please select a category.');
      return;
    }

    // Check rate limiting
    const userIdentifier = localStorage.getItem('user_id') || 'anonymous'
    if (!apiRateLimiter.isAllowed(userIdentifier)) {
      toast.error('Publishing rate limit exceeded. Please wait before publishing again.')
      return
    }

    setIsPublishing(true);

    try {
      const access = localStorage.getItem('access');
      
      if (!access) {
        toast.error('Authentication required for publishing.');
        return;
      }
      
      // Prepare tag names for API - sanitize tags
      const tagNames = [];
      for (const tag of tags) {
        const sanitizedTag = sanitizeText(tag, 50)
        if (!sanitizedTag) continue
        
        // Check if tag exists in availableTags
        const existingTag = availableTags.find(t => t.name === sanitizedTag);
        if (existingTag) {
          tagNames.push(sanitizedTag);
        } else {
          // Create new tag
          const newTag = await createTag(sanitizedTag);
          if (newTag) {
            tagNames.push(newTag.name);
            // Update available tags
            setAvailableTags(prev => [...prev, newTag]);
          }
        }
      }

      const blogData = {
        title: sanitizedTitle,
        content: sanitizedContent,
        excerpt: sanitizedExcerpt || sanitizedContent.replace(/<[^>]*>/g, '').trim().substring(0, 150) + '...',
        category: parseInt(category),
        tag_names: tagNames,
        read_time: String(calculateReadTime(sanitizedContent)),
        is_featured: false, // Can be set later through admin or separate feature
      };

      // This used to POST a new post every time, so publishing a draft you had
      // already saved left two copies. publishDraft patches the existing one
      // when there is one, and creates it otherwise.
      const published = await publishDraft(blogData);
      if (!published) {
        toast.error('Could not publish. Your draft is still saved.');
        return;
      }

      setIsDraft(false);
      toast.success('Blog post published.');
      navigate(`/blog/${published.id}`);
    } catch (error) {
      console.error('Error publishing post:', error);
      toast.error('Error publishing post. Please try again.');
    } finally {
      setIsPublishing(false);
    }
  };

  const handlePreview = () => {
    setIsPreview(!isPreview);
  };

  const addTag = (tag) => {
    if (tag && !tags.includes(tag) && tags.length < 10) {
      setTags([...tags, tag]);
      setTagInput('');
      setTagSuggestions([]);
    }
  };

  const removeTag = (tagToRemove) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleTagInputChange = (value) => {
    setTagInput(value);
    searchTags(value);
  };

  const handleTagInputKeyPress = (e) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      addTag(tagInput.trim());
    }
  };

  const insertText = (before, after = '') => {
    const textarea = editorRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    const newText = content.substring(0, start) + before + selectedText + after + content.substring(end);
    
    setContent(newText);
    
    // Save to undo stack
    setUndoStack(prev => [...prev, content]);
    setRedoStack([]);
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selectedText.length);
    }, 0);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const loadTemplate = (template) => {
    setContent(template.content);
    setTitle(template.name);
  };

  const generateAISuggestion = () => {
    const randomTip = aiWritingTips[Math.floor(Math.random() * aiWritingTips.length)];
    setAiSuggestions(prev => [...prev, {
      id: Date.now(),
      text: randomTip,
      type: 'tip',
      timestamp: new Date()
    }]);
  };

  const calculateReadTime = (content) => {
    const wordsPerMinute = 200;
    // Remove HTML tags for word count calculation
    const textContent = content.replace(/<[^>]*>/g, '').trim();
    const words = textContent.split(/\s+/).filter(word => word.length > 0).length;
    const minutes = Math.ceil(words / wordsPerMinute);
    return `${minutes} min`;
  };

  return (
    <>
      <Helmet>
        <title>Ufazien | Blog Create</title>
        <meta name="description" content="Create and publish your articles on Ufazien's blog." />
      </Helmet>
      <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
        {/* Header */}
        <div className={`sticky top-0 z-50 border-b backdrop-blur-sm ${darkMode ? 'bg-gray-900/90 border-gray-700' : 'bg-white/90 border-gray-200'}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
              <button
                onClick={() => navigate("/dashboard")}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
                <span className="hidden sm:inline">Back</span>
              </button>
              <h1 className="text-base sm:text-xl font-bold truncate bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Ufazien Blog Studio
              </h1>
              {isTyping && (
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span>Writing...</span>
                </div>
              )}
            </div>
            
            <div className="flex items-center space-x-1.5 sm:space-x-3 shrink-0">
              {/* Word count and reading time */}
              <div className="hidden sm:flex items-center space-x-4 text-sm text-gray-500">
                <span>{wordCount} words</span>
                <span>{readingTime} min read</span>
                {lastSaved && (
                  <span>Saved {lastSaved.toLocaleTimeString()}</span>
                )}
              </div>
              
              {/* Action buttons */}
              <button
                onClick={() => setDarkMode(!darkMode)}
                className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
              >
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              
              <button
                onClick={handlePreview}
                className={`flex items-center space-x-2 px-2.5 sm:px-4 py-2 rounded-lg transition-colors ${
                  isPreview 
                    ? 'bg-blue-600 text-white' 
                    : darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'
                }`}
              >
                <Eye className="w-4 h-4" />
                <span className="hidden sm:inline">Preview</span>
              </button>
              
              <button
                onClick={handleSave}
                className={`flex items-center space-x-2 px-2.5 sm:px-4 py-2 rounded-lg transition-colors ${
                  darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'
                }`}
              >
                <Save className="w-4 h-4" />
                <span className="hidden sm:inline">Save</span>
              </button>
              
              <button
                onClick={handlePublish}
                disabled={isPublishing || !title.trim() || !content.trim() || !category}
                className={`flex items-center space-x-2 px-2.5 sm:px-4 py-2 rounded-lg transition-all ${
                  isPublishing || !title.trim() || !content.trim() || !category
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700'
                } text-white`}
              >
                <Send className="w-4 h-4" />
                <span>{isPublishing ? 'Publishing...' : 'Publish'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Editor */}
          <div className={`lg:col-span-3 ${focusMode ? 'lg:col-span-4' : ''}`}>
            <div className={`rounded-xl shadow-sm border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              {/* Title Input */}
              <div className="p-6 pb-0">
                <input
                  type="text"
                  placeholder="Enter your blog title..."
                  value={title}
                  onChange={(e) => {
                    const value = e.target.value
                    // Limit title length and sanitize
                    if (value.length <= 200) {
                      setTitle(value)
                    }
                  }}
                  maxLength="200"
                  className={`w-full text-3xl font-bold border-none outline-none resize-none bg-transparent placeholder-gray-400 ${
                    darkMode ? 'text-white' : 'text-gray-900'
                  }`}
                  style={{ fontFamily }}
                />
              </div>

              {/* Rich Text Editor */}
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Content</h3>
                  <button
                    onClick={() => setFocusMode(!focusMode)}
                    className={`flex items-center space-x-2 px-3 py-1 rounded-lg transition-colors ${
                      focusMode 
                        ? 'bg-blue-100 text-blue-600' 
                        : darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                    }`}
                    title="Focus Mode"
                  >
                    {focusMode ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                    <span className="text-sm">{focusMode ? 'Exit Focus' : 'Focus Mode'}</span>
                  </button>
                </div>
                
                {isPreview ? (
                  <div 
                    ref={previewRef}
                    className={`blog-content ${darkMode ? 'dark' : ''}`}
                    style={{ fontSize: `${fontSize}px`, lineHeight, fontFamily }}
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }}
                  />
                ) : (
                  <RichTextEditor
                    content={content}
                    onChange={setContent}
                    darkMode={darkMode}
                    placeholder="Start writing your amazing blog post..."
                    toast={toast}
                  />
                )}
              </div>

              {/* Writing Progress */}
              <div className={`px-6 pb-4 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
                  <span>Writing Goal: {wordCount}/{writingGoal} words</span>
                  <span>{Math.round(writingProgress)}% complete</span>
                </div>
                <div className={`w-full h-2 rounded-full ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                  <div 
                    className="h-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(writingProgress, 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          {!focusMode && (
            <div className="space-y-6">
              {/* Pomodoro Timer */}
              <div className={`rounded-xl shadow-sm border p-6 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold flex items-center">
                    <Clock className="w-4 h-4 mr-2" />
                    Focus Timer
                  </h3>
                  <button
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className={`p-1 rounded ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                  >
                    {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  </button>
                </div>
                
                <div className="text-center">
                  <div className={`text-3xl font-mono font-bold mb-4 ${isBreak ? 'text-green-500' : 'text-blue-500'}`}>
                    {formatTime(currentTimer)}
                  </div>
                  <div className="text-sm text-gray-500 mb-4">
                    {isBreak ? 'Break Time' : 'Focus Time'}
                  </div>
                  
                  <div className="flex justify-center space-x-2">
                    <button
                      onClick={() => setPomodoroActive(!pomodoroActive)}
                      className={`flex items-center space-x-2 px-2.5 sm:px-4 py-2 rounded-lg transition-colors ${
                        pomodoroActive 
                          ? 'bg-red-500 hover:bg-red-600 text-white' 
                          : 'bg-blue-500 hover:bg-blue-600 text-white'
                      }`}
                    >
                      {pomodoroActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      <span>{pomodoroActive ? 'Pause' : 'Start'}</span>
                    </button>
                    
                    <button
                      onClick={() => {
                        setCurrentTimer(isBreak ? breakTime : pomodoroTime);
                        setPomodoroActive(false);
                      }}
                      className={`p-2 rounded-lg transition-colors ${
                        darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'
                      }`}
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* AI Writing Assistant */}
              <div className={`rounded-xl shadow-sm border p-6 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold flex items-center">
                    <Sparkles className="w-4 h-4 mr-2" />
                    AI Assistant
                  </h3>
                  <button
                    onClick={generateAISuggestion}
                    className="p-1 rounded bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="space-y-3">
                  {aiSuggestions.slice(-3).map((suggestion) => (
                    <div key={suggestion.id} className={`p-3 rounded-lg text-sm ${darkMode ? 'bg-gray-700' : 'bg-blue-50'}`}>
                      <div className="flex items-start space-x-2">
                        <Lightbulb className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                        <p>{suggestion.text}</p>
                      </div>
                    </div>
                  ))}
                  
                  {aiSuggestions.length === 0 && (
                    <p className="text-gray-500 text-sm text-center py-4">
                      Click + to get AI writing suggestions
                    </p>
                  )}
                </div>
              </div>

              {/* SEO Score */}
              <div className={`rounded-xl shadow-sm border p-6 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                <h3 className="font-semibold flex items-center mb-4">
                  <TrendingUp className="w-4 h-4 mr-2" />
                  SEO Score
                </h3>
                
                <div className="text-center">
                  <div className={`text-3xl font-bold mb-2 ${
                    seoScore >= 80 ? 'text-green-500' : 
                    seoScore >= 60 ? 'text-yellow-500' : 'text-red-500'
                  }`}>
                    {seoScore}/100
                  </div>
                  
                  <div className={`w-full h-2 rounded-full mb-4 ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${
                        seoScore >= 80 ? 'bg-green-500' : 
                        seoScore >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${seoScore}%` }}
                    ></div>
                  </div>
                  
                  <div className="text-xs text-gray-500 space-y-1">
                    <div className={title.length > 30 && title.length < 60 ? 'text-green-500' : ''}>
                      ✓ Title length: {title.length}/60
                    </div>
                    <div className={excerpt.length > 120 && excerpt.length < 160 ? 'text-green-500' : ''}>
                      ✓ Meta description: {excerpt.length}/160
                    </div>
                    <div className={wordCount > 300 ? 'text-green-500' : ''}>
                      ✓ Word count: {wordCount}
                    </div>
                    <div className={tags.length >= 3 && tags.length <= 8 ? 'text-green-500' : ''}>
                      ✓ Tags: {tags.length}/8
                    </div>
                  </div>
                </div>
              </div>

              {/* Blog Settings */}
              <div className={`rounded-xl shadow-sm border p-6 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                <h3 className="font-semibold flex items-center mb-4">
                  <Settings className="w-4 h-4 mr-2" />
                  Post Settings
                </h3>
                
                <div className="space-y-4">
                  {/* Category */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className={`w-full p-2 border rounded-lg ${
                        darkMode 
                          ? 'bg-gray-700 border-gray-600 text-white' 
                          : 'bg-white border-gray-300'
                      }`}
                      disabled={isLoadingCategories}
                    >
                      <option value="">
                        {isLoadingCategories ? 'Loading categories...' : 'Select a category'}
                      </option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Visibility */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Visibility</label>
                    <select
                      value={visibility}
                      onChange={(e) => setVisibility(e.target.value)}
                      className={`w-full p-2 border rounded-lg ${
                        darkMode 
                          ? 'bg-gray-700 border-gray-600 text-white' 
                          : 'bg-white border-gray-300'
                      }`}
                    >
                      <option value="public">🌍 Public</option>
                      <option value="unlisted">🔗 Unlisted</option>
                      <option value="private">🔒 Private</option>
                      <option value="friends">👥 Friends Only</option>
                    </select>
                  </div>

                  {/* Excerpt */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Excerpt</label>
                    <textarea
                      placeholder="Brief description for SEO and social sharing..."
                      value={excerpt}
                      onChange={(e) => {
                        const value = e.target.value
                        // Limit excerpt length
                        if (value.length <= 300) {
                          setExcerpt(value)
                        }
                      }}
                      rows={3}
                      maxLength="300"
                      className={`w-full p-2 border rounded-lg resize-none ${
                        darkMode 
                          ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                          : 'bg-white border-gray-300 placeholder-gray-500'
                      }`}
                    />
                    <div className="text-xs text-gray-500 mt-1">
                      {excerpt.length}/300 characters
                    </div>
                  </div>

                  {/* Tags */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Tags {isLoadingTags && <span className="text-xs text-gray-500">(Loading...)</span>}
                    </label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800"
                        >
                          #{tag}
                          <button
                            onClick={() => removeTag(tag)}
                            className="ml-1 hover:text-blue-600"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Type to search or create tags..."
                        value={tagInput}
                        onChange={(e) => handleTagInputChange(e.target.value)}
                        onKeyPress={handleTagInputKeyPress}
                        className={`w-full p-2 border rounded-lg ${
                          darkMode 
                            ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                            : 'bg-white border-gray-300 placeholder-gray-500'
                        }`}
                        disabled={isLoadingTags}
                      />
                      {tagSuggestions.length > 0 && (
                        <div className={`absolute z-10 w-full mt-1 border rounded-lg shadow-lg max-h-40 overflow-y-auto ${
                          darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
                        }`}>
                          {tagSuggestions.map((suggestion) => (
                            <button
                              key={suggestion.id}
                              onClick={() => addTag(suggestion.name)}
                              className={`w-full px-3 py-2 text-left hover:bg-opacity-50 ${
                                darkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-100'
                              }`}
                            >
                              #{suggestion.name}
                            </button>
                          ))}
                          {tagInput.trim() && !tagSuggestions.find(s => s.name.toLowerCase() === tagInput.toLowerCase()) && (
                            <button
                              onClick={() => addTag(tagInput.trim())}
                              className={`w-full px-3 py-2 text-left border-t ${
                                darkMode 
                                  ? 'border-gray-600 text-green-400 hover:bg-gray-600' 
                                  : 'border-gray-200 text-green-600 hover:bg-gray-100'
                              }`}
                            >
                              + Create "{tagInput.trim()}"
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {tags.length}/10 tags • Press Enter to add
                    </div>
                  </div>

                  {/* Publish Date */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Publish Date</label>
                    <input
                      type="datetime-local"
                      value={publishDate}
                      onChange={(e) => setPublishDate(e.target.value)}
                      className={`w-full p-2 border rounded-lg ${
                        darkMode 
                          ? 'bg-gray-700 border-gray-600 text-white' 
                          : 'bg-white border-gray-300'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Templates */}
              <div className={`rounded-xl shadow-sm border p-6 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                <h3 className="font-semibold flex items-center mb-4">
                  <FileText className="w-4 h-4 mr-2" />
                  Templates
                </h3>
                
                <div className="space-y-2">
                  {blogTemplates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => loadTemplate(template)}
                      className={`w-full text-left p-3 rounded-lg transition-colors ${
                        darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="font-medium text-sm">{template.name}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Writing Stats */}
              <div className={`rounded-xl shadow-sm border p-6 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                <h3 className="font-semibold flex items-center mb-4">
                  <Trophy className="w-4 h-4 mr-2" />
                  Writing Stats
                </h3>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Writing Streak</span>
                    <span className="font-semibold">{writingStreak} days</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Daily Goal</span>
                    <span className="font-semibold">{wordCount}/{dailyGoal} words</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Best Time</span>
                    <span className="font-semibold">Morning</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Avg. Speed</span>
                    <span className="font-semibold">45 WPM</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Toast Notifications */}
      <ToastContainer 
        notifications={toastNotifications} 
        removeNotification={removeNotification} 
      />
    </div>
  </>
  );
};

export default BlogCreate;
