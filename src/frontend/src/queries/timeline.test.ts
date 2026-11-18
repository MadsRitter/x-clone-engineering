import { describe, expect, it } from "vitest"

import {
  flattenTimeline,
  TIMELINE_PAGE_SIZE,
  timelineUrl,
  type TimelinePage,
  type Tweet,
} from "@/queries/timeline"

function tweet(id: string): Tweet {
  return {
    id,
    authorId: "u1",
    author: { name: "Ada", handle: "@ada" },
    content: `tweet ${id}`,
    mediaUrls: [],
    createdAt: "2026-11-18T10:00:00.000Z",
    likeCount: 0,
    retweetCount: 0,
    replyCount: 0,
    likedByMe: false,
    retweetedByMe: false,
  }
}

const page = (ids: string[], nextCursor: string | null = null): TimelinePage => ({
  items: ids.map(tweet),
  nextCursor,
})

describe("timelineUrl", () => {
  it("asks for the first page without a cursor", () => {
    expect(timelineUrl()).toBe(`/api/timeline?limit=${TIMELINE_PAGE_SIZE.toString()}`)
    expect(timelineUrl(null)).toBe(`/api/timeline?limit=${TIMELINE_PAGE_SIZE.toString()}`)
  })

  it("passes the cursor for later pages, encoded", () => {
    const url = new URL(timelineUrl("a+b/c="), "http://x")
    expect(url.searchParams.get("cursor")).toBe("a+b/c=")
    expect(url.searchParams.get("limit")).toBe(TIMELINE_PAGE_SIZE.toString())
  })
})

describe("flattenTimeline", () => {
  it("is empty before anything loads", () => {
    expect(flattenTimeline(undefined)).toEqual([])
  })

  it("keeps the pages' order", () => {
    const data = { pages: [page(["3", "2"], "c"), page(["1"])], pageParams: [null, "c"] }
    expect(flattenTimeline(data).map((t) => t.id)).toEqual(["3", "2", "1"])
  })

  it("drops a tweet repeated on a later page", () => {
    const data = { pages: [page(["3", "2"], "c"), page(["2", "1"])], pageParams: [null, "c"] }
    expect(flattenTimeline(data).map((t) => t.id)).toEqual(["3", "2", "1"])
  })
})
