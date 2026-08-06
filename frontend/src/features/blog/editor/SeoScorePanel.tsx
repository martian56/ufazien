import type React from "react"
import { TrendingUp } from "lucide-react"

interface SeoScorePanelProps {
  darkMode: boolean
  seoScore: number
  title: string
  excerpt: string
  wordCount: number
  tagCount: number
}


/**
 * SEO checklist and score, derived from what is in the editor right now.
 *
 * The class names are spelled out rather than interpolated. Tailwind scans
 * source text for complete class names, so `bg-${tone}-500` produces a class
 * that is never generated and an element with no colour at all.
 */
const TONES = {
  good: { text: 'text-green-500', bar: 'bg-green-500' },
  fair: { text: 'text-yellow-500', bar: 'bg-yellow-500' },
  poor: { text: 'text-red-500', bar: 'bg-red-500' },
}

function Check({ passed, children }: { passed: boolean; children: React.ReactNode }) {
  return (
    <div className={passed ? 'text-green-500' : ''}>
      {passed ? '✓ ' : '· '}
      {children}
    </div>
  )
}

export default function SeoScorePanel({ darkMode, seoScore, title, excerpt, wordCount, tagCount }: SeoScorePanelProps) {
  const tone = seoScore >= 80 ? TONES.good : seoScore >= 60 ? TONES.fair : TONES.poor

  return (
    <div className={`rounded-xl shadow-sm border p-6 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
      <h3 className="font-semibold flex items-center mb-4">
        <TrendingUp className="w-4 h-4 mr-2" />
        SEO Score
      </h3>

      <div className="text-center">
        <div className={`text-3xl font-bold mb-2 ${tone.text}`}>{seoScore}/100</div>

        <div className={`w-full h-2 rounded-full mb-4 ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
          <div
            className={`h-2 rounded-full transition-all duration-300 ${tone.bar}`}
            style={{ width: `${seoScore}%` }}
          />
        </div>

        <div className="text-xs text-gray-500 space-y-1 text-left">
          <Check passed={title.length > 30 && title.length < 60}>
            Title length: {title.length}/60
          </Check>
          <Check passed={excerpt.length > 120 && excerpt.length < 160}>
            Meta description: {excerpt.length}/160
          </Check>
          <Check passed={wordCount > 300}>Word count: {wordCount}</Check>
          <Check passed={tagCount >= 3 && tagCount <= 8}>Tags: {tagCount}/8</Check>
        </div>
      </div>
    </div>
  )
}
