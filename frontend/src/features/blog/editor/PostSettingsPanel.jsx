import { Settings, X } from "lucide-react"

/**
 * Category, visibility, excerpt, tags and publish date.
 *
 * Visibility and publish date were collected here and dropped on the floor:
 * neither reached the API, so choosing "Private" published to everyone and a
 * publish date did nothing. Both are sent now, and the wording says what the
 * server actually does with them.
 */

const VISIBILITY_OPTIONS = [
  { value: 'public', label: '🌍 Public', hint: 'Anyone can find and read it.' },
  { value: 'unlisted', label: '🔗 Unlisted', hint: 'Only people with the link. Not listed anywhere.' },
  { value: 'followers', label: '👥 Followers only', hint: 'Only people who follow you.' },
  { value: 'private', label: '🔒 Private', hint: 'Only you.' },
]

export default function PostSettingsPanel({
  darkMode,
  categories,
  isLoadingCategories,
  category,
  onCategoryChange,
  visibility,
  onVisibilityChange,
  excerpt,
  onExcerptChange,
  tags,
  onRemoveTag,
  onAddTag,
  tagInput,
  onTagInputChange,
  onTagInputKeyPress,
  tagSuggestions,
  isLoadingTags,
  publishDate,
  onPublishDateChange,
}) {
  const fieldClass = `w-full p-2 border rounded-lg ${
    darkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 placeholder-gray-500'
  }`
  const selectedVisibility = VISIBILITY_OPTIONS.find((o) => o.value === visibility)

  return (
    <div className={`rounded-xl shadow-sm border p-6 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
      <h3 className="font-semibold flex items-center mb-4">
        <Settings className="w-4 h-4 mr-2" />
        Post Settings
      </h3>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2" htmlFor="post-category">Category</label>
          <select
            id="post-category"
            value={category}
            onChange={(e) => onCategoryChange(e.target.value)}
            className={fieldClass}
            disabled={isLoadingCategories}
          >
            <option value="">{isLoadingCategories ? 'Loading categories...' : 'Select a category'}</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2" htmlFor="post-visibility">Visibility</label>
          <select
            id="post-visibility"
            value={visibility}
            onChange={(e) => onVisibilityChange(e.target.value)}
            className={fieldClass}
          >
            {VISIBILITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          {selectedVisibility && (
            <div className="text-xs text-gray-500 mt-1">{selectedVisibility.hint}</div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2" htmlFor="post-excerpt">Excerpt</label>
          <textarea
            id="post-excerpt"
            placeholder="Brief description for SEO and social sharing..."
            value={excerpt}
            onChange={(e) => {
              if (e.target.value.length <= 300) onExcerptChange(e.target.value)
            }}
            rows={3}
            maxLength="300"
            className={`${fieldClass} resize-none`}
          />
          <div className="text-xs text-gray-500 mt-1">{excerpt.length}/300 characters</div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2" htmlFor="post-tags">
            Tags {isLoadingTags && <span className="text-xs text-gray-500">(Loading...)</span>}
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {tags.map((tag) => (
              <span key={tag} className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                #{tag}
                <button onClick={() => onRemoveTag(tag)} className="ml-1 hover:text-blue-600" aria-label={`Remove ${tag}`}>
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="relative">
            <input
              id="post-tags"
              type="text"
              placeholder="Type to search or create tags..."
              value={tagInput}
              onChange={(e) => onTagInputChange(e.target.value)}
              onKeyPress={onTagInputKeyPress}
              className={fieldClass}
              disabled={isLoadingTags}
            />
            {tagSuggestions.length > 0 && (
              <div className={`absolute z-10 w-full mt-1 border rounded-lg shadow-lg max-h-40 overflow-y-auto ${
                darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
              }`}>
                {tagSuggestions.map((suggestion) => (
                  <button
                    key={suggestion.id}
                    onClick={() => onAddTag(suggestion.name)}
                    className={`w-full px-3 py-2 text-left ${darkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-100'}`}
                  >
                    #{suggestion.name}
                  </button>
                ))}
                {tagInput.trim() && !tagSuggestions.find((s) => s.name.toLowerCase() === tagInput.toLowerCase()) && (
                  <button
                    onClick={() => onAddTag(tagInput.trim())}
                    className={`w-full px-3 py-2 text-left border-t ${
                      darkMode ? 'border-gray-600 text-green-400 hover:bg-gray-600' : 'border-gray-200 text-green-600 hover:bg-gray-100'
                    }`}
                  >
                    + Create "{tagInput.trim()}"
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="text-xs text-gray-500 mt-1">{tags.length}/10 tags • Press Enter to add</div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2" htmlFor="post-publish-date">Publish Date</label>
          <input
            id="post-publish-date"
            type="datetime-local"
            value={publishDate}
            onChange={(e) => onPublishDateChange(e.target.value)}
            className={fieldClass}
          />
          <div className="text-xs text-gray-500 mt-1">
            Leave empty to publish immediately. A future date keeps the post out of
            the blog until then.
          </div>
        </div>
      </div>
    </div>
  )
}
