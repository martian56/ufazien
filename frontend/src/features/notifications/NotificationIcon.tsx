import { Bell, Heart, MessageCircle, PenLine, UserPlus } from "lucide-react"

const BY_TYPE = {
  follow: { Icon: UserPlus, tint: "bg-blue-50 text-blue-600" },
  like_post: { Icon: Heart, tint: "bg-red-50 text-red-600" },
  like_comment: { Icon: Heart, tint: "bg-red-50 text-red-600" },
  comment: { Icon: MessageCircle, tint: "bg-green-50 text-green-600" },
  new_post: { Icon: PenLine, tint: "bg-purple-50 text-purple-600" },
} as const

const FALLBACK = { Icon: Bell, tint: "bg-gray-100 text-gray-600" }

export default function NotificationIcon({
  type,
  size = "md",
}: {
  type: string
  size?: "sm" | "md"
}) {
  const { Icon, tint } = BY_TYPE[type as keyof typeof BY_TYPE] ?? FALLBACK
  const box = size === "sm" ? "h-8 w-8" : "h-10 w-10"
  const glyph = size === "sm" ? "h-4 w-4" : "h-5 w-5"

  return (
    <span className={`flex ${box} shrink-0 items-center justify-center rounded-full ${tint}`}>
      <Icon className={glyph} aria-hidden="true" />
    </span>
  )
}
