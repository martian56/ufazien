import { useState } from 'react'
import { ChevronDown, ChevronRight, Heart, MessageSquare } from 'lucide-react'
import type { CommentNode } from '../commentTree'
import { countThread } from '../commentTree'
import ReplyComposer from './ReplyComposer'
import EditableText from './EditableText'

/**
 * Past this depth the indent eats the text on a phone, so deeper replies keep
 * the parent's indent rather than stepping further right.
 */
const MAX_VISUAL_DEPTH = 5

interface CommentProps {
  node: CommentNode
  onReply: (content: string, parentId: string) => Promise<unknown>
  onToggleLike: (replyId: string) => void
  onEdit: (replyId: string, content: string) => Promise<unknown>
  onDelete: (replyId: string) => Promise<unknown>
  currentUserId?: number | null
}

function Comment({ node, onReply, onToggleLike, onEdit, onDelete, currentUserId }: CommentProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [replying, setReplying] = useState(false)

  const { reply, depth, children } = node
  const indent = Math.min(depth, MAX_VISUAL_DEPTH)
  const hidden = collapsed ? countThread(node) - 1 : 0

  return (
    <div
      className={indent > 0 ? 'border-l border-gray-200 pl-3 sm:pl-4' : ''}
      style={{ marginLeft: indent > 0 ? 4 : 0 }}
    >
      <div className="py-2">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="p-0.5 rounded hover:bg-gray-100 shrink-0"
            aria-label={collapsed ? 'Expand thread' : 'Collapse thread'}
          >
            {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          <span className="font-medium text-gray-900 truncate">
            {reply.author?.full_name || reply.author?.username || 'Unknown'}
          </span>
          <span className="shrink-0">{new Date(reply.created_at).toLocaleDateString()}</span>
          {collapsed && hidden > 0 && (
            <span className="shrink-0 text-gray-400">
              {hidden} more {hidden === 1 ? 'reply' : 'replies'}
            </span>
          )}
        </div>

        {!collapsed && (
          <>
            <EditableText
              value={reply.content}
              canEdit={Boolean(currentUserId) && reply.author?.id === currentUserId}
              onSave={(content) => onEdit(String(reply.id), content)}
              onDelete={() => onDelete(String(reply.id))}
              deleteLabel="Delete this reply and its replies?"
              maxLength={2000}
            >
              <p className="mt-1 text-sm text-gray-800 whitespace-pre-wrap break-words">
                {reply.content}
              </p>
            </EditableText>

            <div className="mt-1.5 flex items-center gap-3">
              <button
                onClick={() => onToggleLike(String(reply.id))}
                className={`inline-flex items-center gap-1 text-xs rounded px-1.5 py-0.5 transition-colors ${
                  reply.is_liked
                    ? 'text-red-600 bg-red-50 hover:bg-red-100'
                    : 'text-gray-500 hover:text-red-600 hover:bg-red-50'
                }`}
              >
                <Heart className={`w-3.5 h-3.5 ${reply.is_liked ? 'fill-current' : ''}`} />
                {reply.like_count > 0 && reply.like_count}
              </button>

              <button
                onClick={() => setReplying((v) => !v)}
                className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 rounded px-1.5 py-0.5 hover:bg-blue-50"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Reply
              </button>
            </div>

            {replying && (
              <div className="mt-2">
                <ReplyComposer
                  autoFocus
                  placeholder={`Reply to ${reply.author?.username || 'this comment'}...`}
                  onSubmit={(content) => onReply(content, String(reply.id))}
                  onCancel={() => setReplying(false)}
                />
              </div>
            )}
          </>
        )}
      </div>

      {!collapsed &&
        children.map((child) => (
          <Comment
            key={child.reply.id}
            node={child}
            onReply={onReply}
            onToggleLike={onToggleLike}
            onEdit={onEdit}
            onDelete={onDelete}
            currentUserId={currentUserId}
          />
        ))}
    </div>
  )
}

interface CommentTreeProps {
  thread: CommentNode[]
  onReply: (content: string, parentId: string) => Promise<unknown>
  onToggleLike: (replyId: string) => void
  onEdit: (replyId: string, content: string) => Promise<unknown>
  onDelete: (replyId: string) => Promise<unknown>
  currentUserId?: number | null
}

export default function CommentTree({
  thread,
  onReply,
  onToggleLike,
  onEdit,
  onDelete,
  currentUserId,
}: CommentTreeProps) {
  if (thread.length === 0) {
    return <p className="py-6 text-sm text-gray-500 text-center">No replies yet. Start the conversation.</p>
  }

  return (
    <div className="divide-y divide-gray-100">
      {thread.map((node) => (
        <Comment
          key={node.reply.id}
          node={node}
          onReply={onReply}
          onToggleLike={onToggleLike}
          onEdit={onEdit}
          onDelete={onDelete}
          currentUserId={currentUserId}
        />
      ))}
    </div>
  )
}
