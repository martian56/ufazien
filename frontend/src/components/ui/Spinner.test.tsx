import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import Spinner from "./Spinner"

afterEach(cleanup)

describe("Spinner", () => {
  it("announces itself to assistive technology", () => {
    render(<Spinner />)
    expect(screen.getByRole("status")).toBeTruthy()
    expect(screen.getByText("Loading")).toBeTruthy()
  })

  it("accepts a custom label", () => {
    render(<Spinner label="Loading dashboard" />)
    expect(screen.getByText("Loading dashboard")).toBeTruthy()
  })

  it("keeps the same ring shape at every size", () => {
    // The bug in #111 was two different shapes appearing in sequence, so the
    // shape must not vary with size: only the diameter and stroke do.
    for (const size of ["sm", "md", "lg"] as const) {
      const { container, unmount } = render(<Spinner size={size} />)
      const ring = container.querySelector(".animate-spin")!
      expect(ring.className).toContain("rounded-full")
      expect(ring.className).toContain("border-t-transparent")
      unmount()
    }
  })

  it("switches to a white ring on a filled background", () => {
    const { container } = render(<Spinner tone="onColor" />)
    const ring = container.querySelector(".animate-spin")!
    expect(ring.className).toContain("border-white")
  })
})
