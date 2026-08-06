import { ArrowLeft, Clock, Heart, MessageCircle } from "lucide-react"

import type { BlogPost } from "../../lib/api/endpoints/blog"

/**
 * BlogRead projects each post into this shape before passing it in: the
 * author is already a formatted name, and category is the category's name
 * rather than the nested object.
 */
export interface RelatedPostSummary {
  id: number
  title: string
  author: string
  read_time?: string
  likes?: number
  category?: string | null
}

interface RelatedReadingProps {
  relatedPosts: RelatedPostSummary[]
  authorPosts: RelatedPostSummary[]
  post: BlogPost | null
  darkMode: boolean
  onOpenPost: (id: number | null) => void
}


/**
 * Further reading: posts sharing this article's tags, and more by its author.
 *
 * Carved out of BlogRead, which held all of this inline in one 1,400-line
 * function.
 */
export default function RelatedReading({ relatedPosts, authorPosts, post, darkMode, onOpenPost }: RelatedReadingProps) {
  return (
    <>
      <div
        className={`mt-12 p-6 rounded-xl border ${
          darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
        }`}
      >
        <h3 className="text-xl font-semibold mb-6">Related Articles</h3>
        {relatedPosts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {relatedPosts.map((relatedPost) => (
              <div
                key={relatedPost.id}
                onClick={() => onOpenPost(relatedPost.id)}
                className={`p-5 rounded-lg border cursor-pointer hover:shadow-lg transition-all duration-200 ${
                  darkMode 
                    ? "border-gray-600 hover:border-gray-500 hover:bg-gray-750" 
                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                <div className="mb-3">
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                    relatedPost.category === "Technology"
                      ? "bg-blue-100 text-blue-700"
                      : relatedPost.category === "Academic"
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-700"
                  }`}>
                    {relatedPost.category}
                  </span>
                </div>
                
                <h4 className="font-semibold mb-3 text-lg leading-tight hover:text-blue-600 transition-colors line-clamp-2">
                  {relatedPost.title}
                </h4>
                
                <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
                  <span className="flex items-center space-x-1">
                    <span>by</span>
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      {relatedPost.author}
                    </span>
                  </span>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-4 text-gray-500">
                    <span className="flex items-center space-x-1">
                      <Clock className="w-3 h-3" />
                      <span>{relatedPost.read_time}</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <Heart className="w-3 h-3" />
                      <span>{relatedPost.likes}</span>
                    </span>
                  </div>
                  
                  <button 
                    onClick={(e) => {
                      e.stopPropagation()
                      onOpenPost(relatedPost.id)
                    }}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                      darkMode
                        ? "bg-blue-600 text-white hover:bg-blue-700"
                        : "bg-blue-100 text-blue-700 hover:bg-blue-200"
                    }`}
                  >
                    Read More
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
              darkMode ? "bg-gray-700" : "bg-gray-100"
            }`}>
              <MessageCircle className="w-8 h-8 text-gray-400" />
            </div>
            <h4 className="text-lg font-medium text-gray-600 mb-2">No Related Articles</h4>
            <p className="text-gray-500 text-sm">
              We couldn't find any related articles at the moment.
            </p>
            <button
              onClick={() => onOpenPost(null)}
              className={`mt-4 px-4 py-2 rounded-lg transition-colors ${
                darkMode
                  ? "bg-gray-700 text-gray-200 hover:bg-gray-600"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Browse All Articles
            </button>
          </div>
        )}
        
        {/* More by Author Section */}
        {authorPosts.length > 0 && (
          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <h4 className="text-lg font-semibold mb-4">
              More by {`${post?.author?.first_name || ""} ${post?.author?.last_name || ""}`.trim() || "This Author"}
            </h4>
            <div className="space-y-3">
              {authorPosts.slice(0, 3).map((authorPost) => (
                <div
                  key={authorPost.id}
                  onClick={() => onOpenPost(authorPost.id)}
                  className={`p-4 rounded-lg border cursor-pointer hover:shadow-md transition-all ${
                    darkMode 
                      ? "border-gray-600 hover:border-gray-500 hover:bg-gray-750" 
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h5 className="font-medium mb-2 hover:text-blue-600 transition-colors line-clamp-2">
                        {authorPost.title}
                      </h5>
                      <div className="flex items-center space-x-3 text-xs text-gray-500">
                        <span className="flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>{authorPost.read_time}</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <Heart className="w-3 h-3" />
                          <span>{authorPost.likes}</span>
                        </span>
                        <span className={`px-2 py-1 rounded text-xs ${
                          authorPost.category === "Technology"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-gray-100 text-gray-700"
                        }`}>
                          {authorPost.category}
                        </span>
                      </div>
                    </div>
                    <ArrowLeft className="w-4 h-4 text-gray-400 rotate-180 ml-2" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
