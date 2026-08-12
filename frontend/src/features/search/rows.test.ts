import { describe, expect, it } from "vitest"

import { DESTINATIONS } from "./destinations"
import { PAGES_GROUP, RECENT_GROUP, buildRows, shouldQueryRemote, step } from "./rows"
import { RECENT_KEY, RECENT_LIMIT, readRecents, rememberRecent, type RecentStore } from "./recent"
import { isSearchShortcut, onApplePlatform, shortcutLabel } from "./searchContext"
import type { SearchHit } from "../../lib/api/endpoints/search"

const hit = (over: Partial<SearchHit> = {}): SearchHit => ({
  type: "blog",
  label: "Blog",
  title: "A post",
  subtitle: "about something",
  url: "/blog/1",
  ...over,
})

function fakeStore(seed?: string): RecentStore & { value: string | null } {
  return {
    value: seed ?? null,
    getItem() {
      return this.value
    },
    setItem(_key: string, next: string) {
      this.value = next
    },
  }
}

describe("what the palette shows before you type", () => {
  it("offers every destination rather than an empty box", () => {
    const rows = buildRows("", [], [])
    expect(rows).toHaveLength(DESTINATIONS.length)
    expect(rows.every((row) => row.kind === "destination")).toBe(true)
  })

  it("puts what you opened last at the top", () => {
    const rows = buildRows("", [{ title: "Calendar", url: "/calendar", group: "Tools" }], [])
    expect(rows[0].kind).toBe("recent")
    expect(rows[0].group).toBe(RECENT_GROUP)
    expect(rows[0].title).toBe("Calendar")
  })

  it("does not list a recent twice", () => {
    const rows = buildRows("", [{ title: "Blog", url: "/blog", group: "Writing" }], [])
    expect(rows.filter((row) => row.url === "/blog")).toHaveLength(1)
    expect(rows).toHaveLength(DESTINATIONS.length)
  })

  it("keeps the group headings in the order they are declared", () => {
    const groups: string[] = []
    for (const row of buildRows("", [], [])) {
      if (groups[groups.length - 1] !== row.group) groups.push(row.group)
    }
    expect(new Set(groups).size).toBe(groups.length)
  })
})

describe("what it shows once you type", () => {
  it("matches pages by title", () => {
    const rows = buildRows("gpa", [], [])
    expect(rows[0].title).toBe("GPA Calculator")
  })

  it("matches pages by keyword", () => {
    expect(buildRows("timetable", [], []).map((r) => r.title)).toContain("Calendar")
  })

  it("puts pages above content from the server", () => {
    const rows = buildRows("blog", [], [hit()])
    const firstContent = rows.findIndex((row) => row.kind === "content")
    const lastPage = rows.map((row) => row.kind).lastIndexOf("destination")
    expect(lastPage).toBeLessThan(firstContent)
  })

  it("drops the recents once there is a query", () => {
    const rows = buildRows("gpa", [{ title: "Blog", url: "/blog", group: "Writing" }], [])
    expect(rows.some((row) => row.kind === "recent")).toBe(false)
  })

  it("keeps the hit type so a result can be iconed", () => {
    const rows = buildRows("x", [], [hit({ type: "person", label: "Student" })])
    expect(rows[rows.length - 1].hitType).toBe("person")
  })

  it("gives every row a key of its own", () => {
    const rows = buildRows("a", [], [hit(), hit(), hit({ url: "/blog/2" })])
    expect(new Set(rows.map((r) => r.key)).size).toBe(rows.length)
  })
})

describe("when to bother the server", () => {
  it("waits for a second character", () => {
    expect(shouldQueryRemote("")).toBe(false)
    expect(shouldQueryRemote("a")).toBe(false)
    expect(shouldQueryRemote("ab")).toBe(true)
  })

  it("does not count padding as typing", () => {
    expect(shouldQueryRemote("  a  ")).toBe(false)
  })
})

describe("moving through the list", () => {
  it("wraps past the end", () => {
    expect(step(2, 1, 3)).toBe(0)
  })

  it("wraps before the start", () => {
    expect(step(0, -1, 3)).toBe(2)
  })

  it("stays put when there is nothing to move through", () => {
    expect(step(0, 1, 0)).toBe(0)
  })
})

describe("remembering where you went", () => {
  it("returns nothing when there is no store", () => {
    expect(readRecents(null)).toEqual([])
  })

  it("survives junk in storage", () => {
    expect(readRecents(fakeStore("not json"))).toEqual([])
    expect(readRecents(fakeStore('{"a":1}'))).toEqual([])
    expect(readRecents(fakeStore('[{"nope":true}]'))).toEqual([])
  })

  it("puts the newest first", () => {
    const store = fakeStore()
    rememberRecent({ title: "One", url: "/one", group: "Go to" }, store)
    const after = rememberRecent({ title: "Two", url: "/two", group: "Go to" }, store)
    expect(after.map((item) => item.url)).toEqual(["/two", "/one"])
  })

  it("moves a repeat visit to the top instead of duplicating it", () => {
    const store = fakeStore()
    rememberRecent({ title: "One", url: "/one", group: "Go to" }, store)
    rememberRecent({ title: "Two", url: "/two", group: "Go to" }, store)
    const after = rememberRecent({ title: "One", url: "/one", group: "Go to" }, store)
    expect(after.map((item) => item.url)).toEqual(["/one", "/two"])
  })

  it("keeps only the last few", () => {
    const store = fakeStore()
    let last: unknown[] = []
    for (let i = 0; i < RECENT_LIMIT + 4; i++) {
      last = rememberRecent({ title: `P${i}`, url: `/p${i}`, group: "Go to" }, store)
    }
    expect(last).toHaveLength(RECENT_LIMIT)
  })

  it("writes under its own key", () => {
    const store = fakeStore()
    let written = ""
    store.setItem = (key: string) => {
      written = key
    }
    rememberRecent({ title: "One", url: "/one", group: "Go to" }, store)
    expect(written).toBe(RECENT_KEY)
  })

  it("still returns the list when storage refuses to write", () => {
    const store = fakeStore()
    store.setItem = () => {
      throw new Error("quota")
    }
    expect(rememberRecent({ title: "One", url: "/one", group: "Go to" }, store)).toHaveLength(1)
  })
})

describe("the shortcut", () => {
  const press = (over: Partial<KeyboardEvent>) =>
    ({ key: "k", code: "KeyK", ctrlKey: false, metaKey: false, altKey: false, ...over }) as KeyboardEvent

  it("opens on control and K", () => {
    expect(isSearchShortcut(press({ ctrlKey: true }))).toBe(true)
  })

  it("opens on command and K", () => {
    expect(isSearchShortcut(press({ metaKey: true }))).toBe(true)
  })

  it("ignores K on its own, so typing a k does nothing", () => {
    expect(isSearchShortcut(press({}))).toBe(false)
  })

  it("ignores the other modifiers", () => {
    expect(isSearchShortcut(press({ ctrlKey: true, altKey: true }))).toBe(false)
  })

  it("still fires on a layout that reports another letter", () => {
    expect(isSearchShortcut(press({ ctrlKey: true, key: "л" }))).toBe(true)
  })

  it("names the key the way the platform prints it", () => {
    expect(onApplePlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")).toBe(true)
    expect(shortcutLabel("Mozilla/5.0 (Macintosh)")).toBe("⌘K")
    expect(shortcutLabel("Mozilla/5.0 (Windows NT 10.0)")).toBe("Ctrl K")
  })
})

describe("every destination is presentable", () => {
  it("carries an icon", () => {
    for (const destination of DESTINATIONS) {
      expect(destination.icon, destination.title).toBeTruthy()
    }
  })

  it("has a distinct url", () => {
    const urls = DESTINATIONS.map((d) => d.url)
    expect(new Set(urls).size).toBe(urls.length)
  })

  it("carries keywords, so it can be found by more than its title", () => {
    for (const destination of DESTINATIONS) {
      expect(destination.keywords.trim(), destination.title).not.toBe("")
    }
  })
})

describe("the group headings", () => {
  const headings = (rows: { group: string }[]) => {
    const out: string[] = []
    for (const row of rows) if (out[out.length - 1] !== row.group) out.push(row.group)
    return out
  }

  it("never repeats a heading while browsing", () => {
    const seen = headings(buildRows("", [], []))
    expect(new Set(seen).size).toBe(seen.length)
  })

  it("never repeats one for a ranked result either", () => {
    for (const query of ["a", "e", "s", "cal", "host", "new", "o"]) {
      const seen = headings(buildRows(query, [], [hit(), hit({ type: "person", label: "Student" })]))
      expect(new Set(seen).size, `"${query}" gave ${seen.join(" / ")}`).toBe(seen.length)
    }
  })

  it("labels a ranked page with the section it came from", () => {
    const rows = buildRows("gpa", [], [])
    expect(rows[0].group).toBe(PAGES_GROUP)
    expect(rows[0].hint).toBe("Tools")
  })

  it("leaves the hint off while browsing, where the heading already says it", () => {
    expect(buildRows("", [], []).every((row) => row.hint === undefined)).toBe(true)
  })
})
