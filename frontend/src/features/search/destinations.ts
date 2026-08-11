export interface Destination {
  title: string
  url: string
  group: string
  keywords: string
}

export const DESTINATIONS: Destination[] = [
  { title: "Dashboard", url: "/dashboard", group: "Go to", keywords: "home overview start" },
  { title: "Profile", url: "/profile", group: "Go to", keywords: "account me avatar bio year major" },
  { title: "Notifications", url: "/notifications", group: "Go to", keywords: "alerts bell unread" },
  { title: "Settings", url: "/settings", group: "Go to", keywords: "preferences account password privacy theme" },
  { title: "Feedback", url: "/feedback", group: "Go to", keywords: "report bug suggestion contact support help" },

  { title: "GPA Calculator", url: "/gpa-calculator", group: "Tools", keywords: "gpa grade point average 4.0 semester yearly credits" },
  { title: "Average Calculator", url: "/average-calculator", group: "Tools", keywords: "average weighted schema marks 20 point coefficient" },
  { title: "Calendar", url: "/calendar", group: "Tools", keywords: "schedule events exams deadlines classes timetable" },
  { title: "Campus Simulator", url: "/campus-simulator", group: "Tools", keywords: "3d game lobby voice map explore" },

  { title: "Blog", url: "/blog", group: "Writing", keywords: "posts articles read" },
  { title: "Write a post", url: "/blog/new", group: "Writing", keywords: "new blog draft compose editor publish" },

  { title: "Community", url: "/community", group: "Community", keywords: "groups forums chat study discussion" },

  { title: "AI Tools", url: "/ai-tools", group: "AI tools", keywords: "assistant" },
  { title: "Humanizer", url: "/ai-tools/humanizer", group: "AI tools", keywords: "humanize rewrite natural ai detector" },
  { title: "Paraphraser", url: "/ai-tools/paraphraser", group: "AI tools", keywords: "paraphrase reword rephrase" },
  { title: "Summarizer", url: "/ai-tools/summarizer", group: "AI tools", keywords: "summarise summary shorten tldr" },
  { title: "Grammar Checker", url: "/ai-tools/grammar-checker", group: "AI tools", keywords: "grammar spelling proofread correct" },

  { title: "User Sites", url: "/user-sites", group: "Hosting", keywords: "directory showcase student projects public" },
  { title: "Hosting", url: "/hosting", group: "Hosting", keywords: "overview dashboard" },
  { title: "Websites", url: "/hosting/websites", group: "Hosting", keywords: "sites deploy list" },
  { title: "New website", url: "/hosting/websites/create", group: "Hosting", keywords: "create deploy upload zip git repository subdomain" },
  { title: "Databases", url: "/hosting/databases", group: "Hosting", keywords: "postgres mysql db sql" },
  { title: "New database", url: "/hosting/databases/create", group: "Hosting", keywords: "create postgres mysql db" },
  { title: "Domains", url: "/hosting/domains", group: "Hosting", keywords: "dns subdomain custom domain" },
  { title: "Hosting analytics", url: "/hosting/analytics", group: "Hosting", keywords: "visitors traffic bandwidth stats" },
  { title: "SSL", url: "/hosting/ssl", group: "Hosting", keywords: "ssl tls https certificate secure" },
  { title: "Logs", url: "/hosting/logs", group: "Hosting", keywords: "logs errors requests debug" },
  { title: "Billing", url: "/hosting/billing", group: "Hosting", keywords: "plan invoice payment subscription" },
  { title: "Hosting settings", url: "/hosting/settings", group: "Hosting", keywords: "configure php environment variables" },
  { title: "Upgrade plan", url: "/hosting/upgrade", group: "Hosting", keywords: "plan pro tier limits" },
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
