import React, { useCallback, useEffect, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import TextStyle from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'
import './RichTextEditor.css'
import { validateImageFile, uploadRateLimiter, isValidImageUrl } from '../utils/security'
import { api, ApiError } from '../lib/api/client'
import { isAuthenticated } from '../lib/api/tokens'

// Custom Image Extension with Resize
const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        renderHTML: attributes => {
          if (!attributes.width) {
            return {}
          }
          return {
            width: attributes.width,
          }
        },
        parseHTML: element => element.getAttribute('width'),
      },
      height: {
        default: null,
        renderHTML: attributes => {
          if (!attributes.height) {
            return {}
          }
          return {
            height: attributes.height,
          }
        },
        parseHTML: element => element.getAttribute('height'),
      },
      alignment: {
        default: 'center',
        renderHTML: attributes => {
          if (!attributes.alignment) {
            return {}
          }
          return {
            'data-alignment': attributes.alignment,
          }
        },
        parseHTML: element => element.getAttribute('data-alignment') || 'center',
      },
    }
  },
  
  renderHTML({ HTMLAttributes }) {
    return ['img', HTMLAttributes]
  },

  addNodeView() {
    return ({ node, view, getPos, editor }) => {
      const container = document.createElement('div')
      container.className = `image-resizer ${node.attrs.alignment ? `align-${node.attrs.alignment}` : 'align-center'}`
      
      const img = document.createElement('img')
      
      // Validate image source for security
      if (node.attrs.src && isValidImageUrl(node.attrs.src)) {
        img.src = node.attrs.src
      } else {
        img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0xMDAgMTIwSDEwMFYxMDBIMTAwVjEyMFoiIGZpbGw9IiM5Q0EzQUYiLz4KPC9zdmc+' // Placeholder image
      }
      
      img.alt = node.attrs.alt || ''
      img.title = node.attrs.title || ''
      
      if (node.attrs.width) img.style.width = node.attrs.width + 'px'
      if (node.attrs.height) img.style.height = node.attrs.height + 'px'
      
      container.appendChild(img)
      
      // Add resize handles
      const handles = ['nw', 'ne', 'sw', 'se']
      handles.forEach(position => {
        const handle = document.createElement('div')
        handle.className = `resize-handle ${position}`
        container.appendChild(handle)
        
        let isResizing = false
        let startX, startY, startWidth, startHeight
        
        handle.addEventListener('mousedown', (e) => {
          e.preventDefault()
          isResizing = true
          startX = e.clientX
          startY = e.clientY
          startWidth = img.offsetWidth
          startHeight = img.offsetHeight
          container.classList.add('resizing')
          
          const handleMouseMove = (e) => {
            if (!isResizing) return
            
            const deltaX = e.clientX - startX
            const deltaY = e.clientY - startY
            
            let newWidth = startWidth
            let newHeight = startHeight
            
            if (position.includes('e')) newWidth = startWidth + deltaX
            if (position.includes('w')) newWidth = startWidth - deltaX
            if (position.includes('s')) newHeight = startHeight + deltaY
            if (position.includes('n')) newHeight = startHeight - deltaY
            
            // Maintain aspect ratio
            const aspectRatio = startWidth / startHeight
            if (e.shiftKey) {
              if (Math.abs(deltaX) > Math.abs(deltaY)) {
                newHeight = newWidth / aspectRatio
              } else {
                newWidth = newHeight * aspectRatio
              }
            }
            
            // Apply constraints
            newWidth = Math.max(50, Math.min(newWidth, 800))
            newHeight = Math.max(50, Math.min(newHeight, 600))
            
            img.style.width = newWidth + 'px'
            img.style.height = newHeight + 'px'
          }
          
          const handleMouseUp = () => {
            if (isResizing) {
              isResizing = false
              container.classList.remove('resizing')
              
              // Update the node attributes
              const newAttrs = {
                ...node.attrs,
                width: img.offsetWidth,
                height: img.offsetHeight
              }
              
              view.dispatch(
                view.state.tr.setNodeMarkup(getPos(), null, newAttrs)
              )
            }
            
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
          }
          
          document.addEventListener('mousemove', handleMouseMove)
          document.addEventListener('mouseup', handleMouseUp)
        })
      })
      
      // Handle selection
      container.addEventListener('click', () => {
        container.classList.add('selected')
        // Remove selection from other images
        document.querySelectorAll('.image-resizer.selected').forEach(el => {
          if (el !== container) el.classList.remove('selected')
        })
      })
      
      return {
        dom: container,
        update: (updatedNode) => {
          if (updatedNode.type !== node.type) return false
          if (updatedNode.attrs.src !== node.attrs.src) {
            // Validate new image source
            if (updatedNode.attrs.src && isValidImageUrl(updatedNode.attrs.src)) {
              img.src = updatedNode.attrs.src
            }
          }
          if (updatedNode.attrs.width !== node.attrs.width) {
            // Validate width constraints
            const width = Math.max(50, Math.min(parseInt(updatedNode.attrs.width) || 0, 800))
            img.style.width = updatedNode.attrs.width ? width + 'px' : 'auto'
          }
          if (updatedNode.attrs.height !== node.attrs.height) {
            // Validate height constraints  
            const height = Math.max(50, Math.min(parseInt(updatedNode.attrs.height) || 0, 600))
            img.style.height = updatedNode.attrs.height ? height + 'px' : 'auto'
          }
          if (updatedNode.attrs.alignment !== node.attrs.alignment) {
            // Validate alignment value
            const validAlignments = ['left', 'center', 'right']
            const alignment = validAlignments.includes(updatedNode.attrs.alignment) ? updatedNode.attrs.alignment : 'center'
            container.className = `image-resizer align-${alignment}`
          }
          node = updatedNode
          return true
        }
      }
    }
  }
})
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Quote,
  Code,
  CodeSquare,
  Heading1,
  Heading2,
  Heading3,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link as LinkIcon,
  ImageIcon,
  MoveLeft,
  MoveRight,
  MoveHorizontal,
  Palette,
  Highlighter,
  Undo,
  Redo,
  Type,
  Minus,
  Plus
} from 'lucide-react'

const MenuBar = ({ editor, darkMode }) => {
  const fileInputRef = useRef(null)

  if (!editor) {
    return null
  }

  const addImage = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleImageUpload = useCallback(async (event) => {
    const file = event.target.files?.[0]
    if (file) {
      try {
        // Validate file before upload
        const validation = validateImageFile(file)
        if (!validation.valid) {
          toast?.error(`Upload failed: ${validation.error}`) || alert(`Upload failed: ${validation.error}`)
          return
        }

        // Check rate limiting
        const userIdentifier = localStorage.getItem('user_id') || 'anonymous'
        if (!uploadRateLimiter.isAllowed(userIdentifier)) {
          toast?.error('Upload rate limit exceeded. Please wait before uploading again.') || alert('Upload rate limit exceeded. Please wait before uploading again.')
          return
        }

        if (!isAuthenticated()) {
          toast?.error('Authentication required for image upload.') || alert('Authentication required for image upload.')
          return
        }

        const formData = new FormData()
        formData.append('image', file)

        try {
          // FormData goes through untouched, so the browser sets the multipart
          // boundary itself.
          const data = await api.post('/blog/upload/image/', formData)

          // Validate the returned URL
          if (data.url && isValidImageUrl(data.url)) {
            editor.chain().focus().setImage({ src: data.url }).run()
          } else {
            toast?.error('Invalid image URL returned from server.') || alert('Invalid image URL returned from server.')
          }
        } catch (uploadError) {
          const reason = uploadError instanceof ApiError ? uploadError.userMessage : 'Unknown error'
          toast?.error(`Failed to upload image: ${reason}`) || alert(`Failed to upload image: ${reason}`)
        }
      } catch (error) {
        console.error('Image upload error:', error)
        toast?.error('Failed to upload image. Please try again.') || alert('Failed to upload image. Please try again.')
      }
    }
    
    // Clear the input
    event.target.value = ''
  }, [editor])

  const setLink = useCallback(() => {
    const previousUrl = editor.getAttributes('link').href
    let url = window.prompt('URL', previousUrl)

    if (url === null) {
      return
    }

    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }

    // Validate and sanitize URL
    try {
      // Add protocol if missing
      if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('mailto:') && !url.startsWith('tel:')) {
        url = 'https://' + url
      }

      const urlObj = new URL(url)
      
      // Only allow safe protocols
      const allowedProtocols = ['http:', 'https:', 'mailto:', 'tel:']
      if (!allowedProtocols.includes(urlObj.protocol)) {
        toast?.error('Invalid URL protocol. Only HTTP, HTTPS, mailto, and tel are allowed.') || alert('Invalid URL protocol. Only HTTP, HTTPS, mailto, and tel are allowed.')
        return
      }

      // Set the link with security attributes
      editor.chain().focus().extendMarkRange('link').setLink({ 
        href: url,
        rel: 'noopener noreferrer',
        target: '_blank'
      }).run()
    } catch (error) {
      toast?.error('Invalid URL format. Please enter a valid URL.') || alert('Invalid URL format. Please enter a valid URL.')
    }
  }, [editor])

  const alignImage = useCallback((alignment) => {
    const { selection } = editor.state
    const { from } = selection
    const node = editor.state.doc.nodeAt(from)
    
    if (node && node.type.name === 'resizableImage') {
      const tr = editor.state.tr
      const newAttrs = {
        ...node.attrs,
        alignment: alignment
      }
      tr.setNodeMarkup(from, null, newAttrs)
      editor.view.dispatch(tr)
    }
  }, [editor])

  const colors = [
    '#000000', '#e60000', '#ff9900', '#ffff00', '#008a00', '#0066cc', '#9933ff',
    '#ffffff', '#facccc', '#ffebcc', '#ffffcc', '#cce8cc', '#cce0f5', '#ebd6ff',
    '#bbbbbb', '#f06666', '#ffc266', '#ffff66', '#66b266', '#66a3e0', '#c285ff',
    '#888888', '#a10000', '#b26b00', '#b2b200', '#006100', '#0047b2', '#6b24b2',
    '#444444', '#5c0000', '#663d00', '#666600', '#003700', '#002966', '#3d1466'
  ]

  return (
    <div className={`flex flex-wrap items-center gap-1 p-4 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
      {/* Undo/Redo */}
      <div className="flex items-center gap-1 mr-2">
        <button
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().chain().focus().undo().run()}
          className={`p-2 rounded hover:bg-gray-100 disabled:opacity-50 ${darkMode ? 'hover:bg-gray-700' : ''}`}
          title="Undo"
        >
          <Undo className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().chain().focus().redo().run()}
          className={`p-2 rounded hover:bg-gray-100 disabled:opacity-50 ${darkMode ? 'hover:bg-gray-700' : ''}`}
          title="Redo"
        >
          <Redo className="w-4 h-4" />
        </button>
      </div>

      <div className={`w-px h-6 ${darkMode ? 'bg-gray-700' : 'bg-gray-300'}`}></div>

      {/* Text formatting */}
      <div className="flex items-center gap-1 mr-2">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-2 rounded hover:bg-gray-100 ${
            editor.isActive('bold') ? 'bg-blue-100 text-blue-600' : ''
          } ${darkMode ? 'hover:bg-gray-700' : ''}`}
          title="Bold"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-2 rounded hover:bg-gray-100 ${
            editor.isActive('italic') ? 'bg-blue-100 text-blue-600' : ''
          } ${darkMode ? 'hover:bg-gray-700' : ''}`}
          title="Italic"
        >
          <Italic className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`p-2 rounded hover:bg-gray-100 ${
            editor.isActive('underline') ? 'bg-blue-100 text-blue-600' : ''
          } ${darkMode ? 'hover:bg-gray-700' : ''}`}
          title="Underline"
        >
          <UnderlineIcon className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`p-2 rounded hover:bg-gray-100 ${
            editor.isActive('strike') ? 'bg-blue-100 text-blue-600' : ''
          } ${darkMode ? 'hover:bg-gray-700' : ''}`}
          title="Strikethrough"
        >
          <Type className="w-4 h-4" />
        </button>
      </div>

      <div className={`w-px h-6 ${darkMode ? 'bg-gray-700' : 'bg-gray-300'}`}></div>

      {/* Headings */}
      <div className="flex items-center gap-1 mr-2">
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`p-2 rounded hover:bg-gray-100 ${
            editor.isActive('heading', { level: 1 }) ? 'bg-blue-100 text-blue-600' : ''
          } ${darkMode ? 'hover:bg-gray-700' : ''}`}
          title="Heading 1"
        >
          <Heading1 className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`p-2 rounded hover:bg-gray-100 ${
            editor.isActive('heading', { level: 2 }) ? 'bg-blue-100 text-blue-600' : ''
          } ${darkMode ? 'hover:bg-gray-700' : ''}`}
          title="Heading 2"
        >
          <Heading2 className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`p-2 rounded hover:bg-gray-100 ${
            editor.isActive('heading', { level: 3 }) ? 'bg-blue-100 text-blue-600' : ''
          } ${darkMode ? 'hover:bg-gray-700' : ''}`}
          title="Heading 3"
        >
          <Heading3 className="w-4 h-4" />
        </button>
      </div>

      <div className={`w-px h-6 ${darkMode ? 'bg-gray-700' : 'bg-gray-300'}`}></div>

      {/* Lists and quotes */}
      <div className="flex items-center gap-1 mr-2">
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-2 rounded hover:bg-gray-100 ${
            editor.isActive('bulletList') ? 'bg-blue-100 text-blue-600' : ''
          } ${darkMode ? 'hover:bg-gray-700' : ''}`}
          title="Bullet List"
        >
          <List className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-2 rounded hover:bg-gray-100 ${
            editor.isActive('orderedList') ? 'bg-blue-100 text-blue-600' : ''
          } ${darkMode ? 'hover:bg-gray-700' : ''}`}
          title="Numbered List"
        >
          <ListOrdered className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`p-2 rounded hover:bg-gray-100 ${
            editor.isActive('blockquote') ? 'bg-blue-100 text-blue-600' : ''
          } ${darkMode ? 'hover:bg-gray-700' : ''}`}
          title="Quote"
        >
          <Quote className="w-4 h-4" />
        </button>
      </div>

      <div className={`w-px h-6 ${darkMode ? 'bg-gray-700' : 'bg-gray-300'}`}></div>

      {/* Code */}
      <div className="flex items-center gap-1 mr-2">
        <button
          onClick={() => editor.chain().focus().toggleCode().run()}
          className={`p-2 rounded hover:bg-gray-100 ${
            editor.isActive('code') ? 'bg-blue-100 text-blue-600' : ''
          } ${darkMode ? 'hover:bg-gray-700' : ''}`}
          title="Inline Code"
        >
          <Code className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={`p-2 rounded hover:bg-gray-100 ${
            editor.isActive('codeBlock') ? 'bg-blue-100 text-blue-600' : ''
          } ${darkMode ? 'hover:bg-gray-700' : ''}`}
          title="Code Block"
        >
          <CodeSquare className="w-4 h-4" />
        </button>
      </div>

      <div className={`w-px h-6 ${darkMode ? 'bg-gray-700' : 'bg-gray-300'}`}></div>

      {/* Alignment */}
      <div className="flex items-center gap-1 mr-2">
        <button
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          className={`p-2 rounded hover:bg-gray-100 ${
            editor.isActive({ textAlign: 'left' }) ? 'bg-blue-100 text-blue-600' : ''
          } ${darkMode ? 'hover:bg-gray-700' : ''}`}
          title="Align Left"
        >
          <AlignLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          className={`p-2 rounded hover:bg-gray-100 ${
            editor.isActive({ textAlign: 'center' }) ? 'bg-blue-100 text-blue-600' : ''
          } ${darkMode ? 'hover:bg-gray-700' : ''}`}
          title="Align Center"
        >
          <AlignCenter className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          className={`p-2 rounded hover:bg-gray-100 ${
            editor.isActive({ textAlign: 'right' }) ? 'bg-blue-100 text-blue-600' : ''
          } ${darkMode ? 'hover:bg-gray-700' : ''}`}
          title="Align Right"
        >
          <AlignRight className="w-4 h-4" />
        </button>
      </div>

      <div className={`w-px h-6 ${darkMode ? 'bg-gray-700' : 'bg-gray-300'}`}></div>

      {/* Media and links */}
      <div className="flex items-center gap-1 mr-2">
        <button
          onClick={setLink}
          className={`p-2 rounded hover:bg-gray-100 ${
            editor.isActive('link') ? 'bg-blue-100 text-blue-600' : ''
          } ${darkMode ? 'hover:bg-gray-700' : ''}`}
          title="Add Link"
        >
          <LinkIcon className="w-4 h-4" />
        </button>
        <button
          onClick={addImage}
          className={`p-2 rounded hover:bg-gray-100 ${darkMode ? 'hover:bg-gray-700' : ''}`}
          title="Add Image"
        >
          <ImageIcon className="w-4 h-4" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="hidden"
        />
        <button
          onClick={() => alignImage('left')}
          className={`p-2 rounded hover:bg-gray-100 ${darkMode ? 'hover:bg-gray-700' : ''}`}
          title="Align Image Left"
        >
          <MoveLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => alignImage('center')}
          className={`p-2 rounded hover:bg-gray-100 ${darkMode ? 'hover:bg-gray-700' : ''}`}
          title="Align Image Center"
        >
          <MoveHorizontal className="w-4 h-4" />
        </button>
        <button
          onClick={() => alignImage('right')}
          className={`p-2 rounded hover:bg-gray-100 ${darkMode ? 'hover:bg-gray-700' : ''}`}
          title="Align Image Right"
        >
          <MoveRight className="w-4 h-4" />
        </button>
      </div>

      <div className={`w-px h-6 ${darkMode ? 'bg-gray-700' : 'bg-gray-300'}`}></div>

      {/* Color picker */}
      <div className="flex items-center gap-1 mr-2">
        <div className="relative group">
          <button
            className={`p-2 rounded hover:bg-gray-100 ${darkMode ? 'hover:bg-gray-700' : ''}`}
            title="Text Color"
          >
            <Palette className="w-4 h-4" />
          </button>
          <div className={`absolute top-full left-0 mt-1 p-2 rounded-lg shadow-lg border z-10 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all ${
            darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          }`}>
            <div className="grid grid-cols-7 gap-1">
              {colors.map((color) => (
                <button
                  key={color}
                  onClick={() => editor.chain().focus().setColor(color).run()}
                  className="w-6 h-6 rounded border border-gray-300 hover:scale-110 transition-transform"
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>
        </div>
        <button
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          className={`p-2 rounded hover:bg-gray-100 ${
            editor.isActive('highlight') ? 'bg-blue-100 text-blue-600' : ''
          } ${darkMode ? 'hover:bg-gray-700' : ''}`}
          title="Highlight"
        >
          <Highlighter className="w-4 h-4" />
        </button>
      </div>

      <div className={`w-px h-6 ${darkMode ? 'bg-gray-700' : 'bg-gray-300'}`}></div>

      {/* Divider */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          className={`p-2 rounded hover:bg-gray-100 ${darkMode ? 'hover:bg-gray-700' : ''}`}
          title="Horizontal Rule"
        >
          <Minus className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

const RichTextEditor = ({ content, onChange, darkMode = false, placeholder = "Start writing...", toast }) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: {
          HTMLAttributes: {
            class: 'rounded-lg bg-gray-100 p-4 my-4 font-mono text-sm overflow-x-auto',
          },
        },
      }),
      ResizableImage.configure({
        inline: true,
        allowBase64: true,
        HTMLAttributes: {
          class: 'max-w-full h-auto rounded-lg my-4',
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 hover:text-blue-800 underline',
        },
      }),
      TextStyle,
      Color,
      Highlight.configure({
        HTMLAttributes: {
          class: 'bg-yellow-200 px-1 rounded',
        },
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Underline,
    ],
    content: content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: `prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none min-h-[400px] p-6 ${
          darkMode ? 'prose-invert text-white' : 'text-gray-900'
        }`,
      },
    },
  })

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content)
    }
  }, [content, editor])

  return (
    <div className={`border rounded-lg ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
      <MenuBar editor={editor} darkMode={darkMode} />
      <div className={`min-h-[400px] ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}

export default RichTextEditor
