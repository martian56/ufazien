import { useEffect, useState } from 'react'
import { Trophy } from 'lucide-react'
import { blogApi, type WritingStats } from '../../../lib/api/endpoints/blog'
import { logger } from '../../../lib/logger'

/**
 * Writing statistics for the signed-in author.
 *
 * Every number here used to be invented. The streak was a useState(0) that
 * nothing ever set, so it read "0 days" forever; "Best Time: Morning" and
 * "Avg. Speed: 45 WPM" were literals in the JSX. They now come from
 * /blog/my-stats/, which counts the author's own posts, and anything the
 * server cannot count is not shown at all.
 */

function describeHour(hour: number): string {
  if (hour < 5) return 'Late night'
  if (hour < 12) return 'Morning'
  if (hour < 17) return 'Afternoon'
  if (hour < 21) return 'Evening'
  return 'Night'
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  )
}

export default function WritingStatsPanel({ darkMode }: { darkMode: boolean }) {
  const [stats, setStats] = useState<WritingStats | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    blogApi
      .myStats()
      .then((data) => {
        if (active) setStats(data)
      })
      .catch((error) => {
        logger.error('Could not load writing stats', error)
        if (active) setFailed(true)
      })
    return () => {
      active = false
    }
  }, [])

  const shell = `rounded-xl shadow-sm border p-6 ${
    darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
  }`

  return (
    <div className={shell}>
      <h3 className="font-semibold flex items-center mb-4">
        <Trophy className="w-4 h-4 mr-2" />
        Writing Stats
      </h3>

      {failed ? (
        <p className="text-sm text-gray-500">Stats are unavailable right now.</p>
      ) : !stats ? (
        <p className="text-sm text-gray-500">Loading your stats...</p>
      ) : (
        <div className="space-y-3">
          <Row
            label="Writing Streak"
            value={stats.streak_days === 1 ? '1 day' : `${stats.streak_days} days`}
          />
          <Row
            label="This Week"
            value={stats.posts_this_week === 1 ? '1 day' : `${stats.posts_this_week} days`}
          />
          <Row label="Published" value={String(stats.published)} />
          <Row label="Drafts" value={String(stats.drafts)} />
          {stats.best_hour !== null && (
            <Row label="You write most in the" value={describeHour(stats.best_hour)} />
          )}
        </div>
      )}
    </div>
  )
}
