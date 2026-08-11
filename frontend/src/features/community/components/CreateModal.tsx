import { useState } from "react"
import type React from "react"
import { X } from "lucide-react"
import type { Forum, NewForumPost } from "../../../lib/api/endpoints/community"
import Select from "../../../components/ui/Select"

interface CreateModalProps {
  type: "group" | "forum" | "post"
  onClose: () => void
  onCreateGroup: (data: Record<string, unknown>) => void
  onCreateForum: (data: Record<string, unknown>) => void
  onCreatePost: (data: NewForumPost) => void
  forums: Forum[]
  categories: { id: string; name: string }[]
}


export default function CreateModal({
  type,
  onClose,
  onCreateGroup,
  onCreateForum,
  onCreatePost,
  forums,
  categories,
}: CreateModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    title: "",
    description: "",
    category: "general",
    type: "public",
    maxMembers: 30,
    tags: [] as string[],
    courseCode: "",
    professor: "",
    content: "",
    forumId: "",
    iconName: "MessageCircle",
    colorClass: "bg-blue-500"
  })
  const [tagInput, setTagInput] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      if (type === "group") {
        await onCreateGroup({
          name: formData.name,
          description: formData.description,
          category: formData.category,
          type: formData.type,
          max_members: formData.maxMembers,
          tags: formData.tags,
          course_code: formData.courseCode || null,
          professor: formData.professor || null
        })
      } else if (type === "forum") {
        await onCreateForum({
          title: formData.title,
          description: formData.description,
          category: formData.category,
          icon_name: formData.iconName,
          color_class: formData.colorClass
        })
      } else if (type === "post") {
        await onCreatePost({
          title: formData.title,
          content: formData.content,
          // forum_id, not forum: ForumPostCreateSerializer declares a
          // write-only forum_id, so sending `forum` was rejected as a missing
          // required field and the post was never created.
          forum_id: formData.forumId,
          tags: formData.tags
        })
      }
    } catch (error) {
      console.error("Error creating:", error)
    }
  }

  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()]
      }))
      setTagInput("")
    }
  }

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }))
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              Create {type === "group" ? "Study Group" : type === "forum" ? "Forum" : "Post"}
            </h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Title/Name Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {type === "group" ? "Group Name" : "Title"}
              </label>
              <input
                type="text"
                value={type === "group" ? formData.name : formData.title}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  [type === "group" ? "name" : "title"]: e.target.value
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                required
              />
            </div>

            {/* Description/Content Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {type === "post" ? "Content" : "Description"}
              </label>
              <textarea
                value={type === "post" ? formData.content : formData.description}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  [type === "post" ? "content" : "description"]: e.target.value
                }))}
                rows={type === "post" ? 6 : 3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                required
              />
            </div>

            {/* Forum Selection for Posts */}
            {type === "post" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Forum
                </label>
                <Select
                  value={formData.forumId}
                  onChange={(value) => setFormData(prev => ({ ...prev, forumId: value }))}
                  options={forums.map((forum) => ({ value: String(forum.id), label: forum.title }))}
                  placeholder="Select a forum"
                  aria-label="Forum"
                />
              </div>
            )}

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category
              </label>
              <Select
                value={formData.category}
                onChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                options={categories.map((cat) => ({ value: String(cat.id), label: cat.name }))}
                aria-label="Category"
              />
            </div>

            {/* Group-specific fields */}
            {type === "group" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Group Type
                    </label>
                    <Select
        value={formData.type}
        onChange={(value) => setFormData(prev => ({ ...prev, type: value }))}
        options={[
          { value: "public", label: "Public" },
          { value: "private", label: "Private" },
        ]}
      />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Max Members
                    </label>
                    <input
                      type="number"
                      value={formData.maxMembers}
                      onChange={(e) => setFormData(prev => ({ ...prev, maxMembers: parseInt(e.target.value) }))}
                      min="2"
                      max="100"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Course Code (Optional)
                    </label>
                    <input
                      type="text"
                      value={formData.courseCode}
                      onChange={(e) => setFormData(prev => ({ ...prev, courseCode: e.target.value }))}
                      placeholder="e.g., CS301"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Professor (Optional)
                    </label>
                    <input
                      type="text"
                      value={formData.professor}
                      onChange={(e) => setFormData(prev => ({ ...prev, professor: e.target.value }))}
                      placeholder="e.g., Dr. Smith"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Forum-specific fields */}
            {type === "forum" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Icon
                  </label>
                  <Select
        value={formData.iconName}
        onChange={(value) => setFormData(prev => ({ ...prev, iconName: value }))}
        options={[
          { value: "MessageCircle", label: "Message Circle" },
          { value: "Book", label: "Book" },
          { value: "Briefcase", label: "Briefcase" },
          { value: "Code", label: "Code" },
          { value: "Coffee", label: "Coffee" },
          { value: "Camera", label: "Camera" },
        ]}
      />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Color
                  </label>
                  <Select
        value={formData.colorClass}
        onChange={(value) => setFormData(prev => ({ ...prev, colorClass: value }))}
        options={[
          { value: "bg-blue-500", label: "Blue" },
          { value: "bg-green-500", label: "Green" },
          { value: "bg-purple-500", label: "Purple" },
          { value: "bg-red-500", label: "Red" },
          { value: "bg-yellow-500", label: "Yellow" },
          { value: "bg-indigo-500", label: "Indigo" },
        ]}
      />
                </div>
              </div>
            )}

            {/* Tags */}
            {(type === "group" || type === "post") && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tags
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                    placeholder="Add a tag"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                  <button
                    type="button"
                    onClick={addTag}
                    className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs flex items-center gap-1"
                    >
                      #{tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="text-blue-500 hover:text-blue-700"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Submit Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Create {type === "group" ? "Group" : type === "forum" ? "Forum" : "Post"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// Private Chat Modal Component
