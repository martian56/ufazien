export interface Destination {
  title: string
  url: string
  group: string
  keywords: string
  icon: IconName
}

export type IconName =
  | "dashboard" | "user" | "bell" | "settings" | "feedback"
  | "gpa" | "average" | "calendar" | "campus"
  | "blog" | "write" | "community"
  | "ai" | "humanize" | "paraphrase" | "summarize" | "grammar"
  | "showcase" | "hosting" | "website" | "newWebsite" | "database" | "newDatabase"
  | "domain" | "analytics" | "ssl" | "logs" | "billing" | "hostingSettings" | "upgrade"

export const DESTINATIONS: Destination[] = [
  { title: "Dashboard", url: "/dashboard", group: "Go to", keywords: "home overview start", icon: "dashboard" },
  { title: "Profile", url: "/profile", group: "Go to", keywords: "account me avatar bio year major", icon: "user" },
  { title: "Notifications", url: "/notifications", group: "Go to", keywords: "alerts bell unread", icon: "bell" },
  { title: "Settings", url: "/settings", group: "Go to", keywords: "preferences account password privacy theme", icon: "settings" },
  { title: "Feedback", url: "/feedback", group: "Go to", keywords: "report bug suggestion contact support help", icon: "feedback" },

  { title: "GPA Calculator", url: "/gpa-calculator", group: "Tools", keywords: "gpa grade point average 4.0 semester yearly credits", icon: "gpa" },
  { title: "Average Calculator", url: "/average-calculator", group: "Tools", keywords: "average weighted schema marks 20 point coefficient", icon: "average" },
  { title: "Calendar", url: "/calendar", group: "Tools", keywords: "schedule events exams deadlines classes timetable", icon: "calendar" },
  { title: "Campus Simulator", url: "/campus-simulator", group: "Tools", keywords: "3d game lobby voice map explore", icon: "campus" },

  { title: "Blog", url: "/blog", group: "Writing", keywords: "posts articles read", icon: "blog" },
  { title: "Write a post", url: "/blog/new", group: "Writing", keywords: "new blog draft compose editor publish", icon: "write" },

  { title: "Community", url: "/community", group: "Community", keywords: "groups forums chat study discussion", icon: "community" },

  { title: "AI Tools", url: "/ai-tools", group: "AI tools", keywords: "assistant", icon: "ai" },
  { title: "Humanizer", url: "/ai-tools/humanizer", group: "AI tools", keywords: "humanize rewrite natural ai detector", icon: "humanize" },
  { title: "Paraphraser", url: "/ai-tools/paraphraser", group: "AI tools", keywords: "paraphrase reword rephrase", icon: "paraphrase" },
  { title: "Summarizer", url: "/ai-tools/summarizer", group: "AI tools", keywords: "summarise summary shorten tldr", icon: "summarize" },
  { title: "Grammar Checker", url: "/ai-tools/grammar-checker", group: "AI tools", keywords: "grammar spelling proofread correct", icon: "grammar" },

  { title: "User Sites", url: "/user-sites", group: "Hosting", keywords: "directory showcase student projects public", icon: "showcase" },
  { title: "Hosting", url: "/hosting", group: "Hosting", keywords: "overview dashboard", icon: "hosting" },
  { title: "Websites", url: "/hosting/websites", group: "Hosting", keywords: "sites deploy list", icon: "website" },
  { title: "New website", url: "/hosting/websites/create", group: "Hosting", keywords: "create deploy upload zip git repository subdomain", icon: "newWebsite" },
  { title: "Databases", url: "/hosting/databases", group: "Hosting", keywords: "postgres mysql db sql", icon: "database" },
  { title: "New database", url: "/hosting/databases/create", group: "Hosting", keywords: "create postgres mysql db", icon: "newDatabase" },
  { title: "Domains", url: "/hosting/domains", group: "Hosting", keywords: "dns subdomain custom domain", icon: "domain" },
  { title: "Hosting analytics", url: "/hosting/analytics", group: "Hosting", keywords: "visitors traffic bandwidth stats", icon: "analytics" },
  { title: "SSL", url: "/hosting/ssl", group: "Hosting", keywords: "ssl tls https certificate secure", icon: "ssl" },
  { title: "Logs", url: "/hosting/logs", group: "Hosting", keywords: "logs errors requests debug", icon: "logs" },
  { title: "Billing", url: "/hosting/billing", group: "Hosting", keywords: "plan invoice payment subscription", icon: "billing" },
  { title: "Hosting settings", url: "/hosting/settings", group: "Hosting", keywords: "configure php environment variables", icon: "hostingSettings" },
  { title: "Upgrade plan", url: "/hosting/upgrade", group: "Hosting", keywords: "plan pro tier limits", icon: "upgrade" },
]

export function matchDestinations(query: string, limit = 6): Destination[] {
  const q = query.trim().toLowerCase()
  if (!q) return []

  const scored = DESTINATIONS.map((d) => {
    const title = d.title.toLowerCase()
    const titleWords = title.split(/[\s-]+/)
    const keywords = d.keywords.split(" ")
    let score = 0
    if (title === q) score = 100
    else if (title.startsWith(q)) score = 85
    else if (titleWords.some((w) => w.startsWith(q))) score = 70
    else if (keywords.some((k) => k === q)) score = 65
    else if (keywords.some((k) => k.startsWith(q))) score = 45
    else if (title.includes(q)) score = 30
    else if (d.keywords.includes(q)) score = 20
    return { d, score }
  }).filter((s) => s.score > 0)

  scored.sort((a, b) => b.score - a.score || a.d.title.localeCompare(b.d.title))
  return scored.slice(0, limit).map((s) => s.d)
}
