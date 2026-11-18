import type { InfiniteData } from "@tanstack/react-query"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { TimelinePage, Tweet } from "@/queries/timeline"
import {
  canPost,
  IMAGE_MAX_BYTES,
  imageProblem,
  MESSAGES,
  PostTweetError,
  postTweet,
  prependTweet,
  tooLongMessage,
  TWEET_MAX_LENGTH,
} from "@/queries/tweets"

function tweet(id: string): Tweet {
  return {
    id,
    authorId: "u1",
    author: { name: "Ada", handle: "ada" },
    content: `tweet ${id}`,
    mediaUrls: [],
    createdAt: "2026-11-18T12:00:00.000Z",
    likeCount: 0,
    retweetCount: 0,
    replyCount: 0,
    likedByMe: false,
    retweetedByMe: false,
  }
}

const png = (size = 10) => new File([new Uint8Array(size)], "a.png", { type: "image/png" })

describe("tooLongMessage", () => {
  it("is fine up to the limit", () => {
    expect(tooLongMessage("x".repeat(TWEET_MAX_LENGTH))).toBeNull()
  })

  it("says by how much a tweet is over, in the singular and the plural", () => {
    expect(tooLongMessage("x".repeat(TWEET_MAX_LENGTH + 1))).toBe(
      "Your tweet is 1 character too long. Tweets can be at most 280 characters."
    )
    expect(tooLongMessage("x".repeat(TWEET_MAX_LENGTH + 5))).toMatch(/^Your tweet is 5 characters too long/)
  })

  it("ignores the spaces around the text, as the API does", () => {
    expect(tooLongMessage(`  ${"x".repeat(TWEET_MAX_LENGTH)}  `)).toBeNull()
  })
})

describe("imageProblem", () => {
  it("accepts JPEG, PNG, WebP and GIF up to 5 MB", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp", "image/gif"]) {
      expect(imageProblem({ type, size: IMAGE_MAX_BYTES })).toBeNull()
    }
  })

  it("rejects other files and bigger images", () => {
    expect(imageProblem({ type: "text/plain", size: 5 })).toBe(MESSAGES.notAnImage)
    expect(imageProblem({ type: "image/svg+xml", size: 5 })).toBe(MESSAGES.notAnImage)
    expect(imageProblem({ type: "image/png", size: IMAGE_MAX_BYTES + 1 })).toBe(MESSAGES.imageTooBig)
  })
})

describe("canPost", () => {
  it("needs text or an image", () => {
    expect(canPost("", null)).toBe(false)
    expect(canPost("  \n ", null)).toBe(false)
    expect(canPost("hi", null)).toBe(true)
    expect(canPost("", png())).toBe(true)
  })

  it("refuses text over the limit, even with an image", () => {
    expect(canPost("x".repeat(TWEET_MAX_LENGTH + 1), png())).toBe(false)
  })
})

describe("prependTweet", () => {
  const data = (...pages: Tweet[][]): InfiniteData<TimelinePage> => ({
    pages: pages.map((items) => ({ items, nextCursor: null })),
    pageParams: pages.map(() => null),
  })

  it("puts the new tweet first on the first page", () => {
    const next = prependTweet(data([tweet("a")], [tweet("b")]), tweet("new"))
    expect(next?.pages.map((p) => p.items.map((t) => t.id))).toEqual([["new", "a"], ["b"]])
  })

  it("doesn't show it twice if it's already on the first page", () => {
    const next = prependTweet(data([tweet("a"), tweet("new")]), tweet("new"))
    expect(next?.pages[0].items.map((t) => t.id)).toEqual(["new", "a"])
  })

  it("leaves an unloaded timeline alone", () => {
    expect(prependTweet(undefined, tweet("new"))).toBeUndefined()
  })
})

describe("postTweet", () => {
  afterEach(() => vi.unstubAllGlobals())

  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

  it("uploads the image first, then posts the trimmed text with its key, with cookies", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(201, { keys: ["tweets/k.png"] }))
      .mockResolvedValueOnce(json(201, tweet("t1")))
    vi.stubGlobal("fetch", fetchMock)

    await postTweet({ content: "  hello  ", image: png() })

    expect(fetchMock.mock.calls[0][0]).toBe("/api/upload")
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "POST", credentials: "include" })
    expect(fetchMock.mock.calls[1][0]).toBe("/api/tweets")
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: "POST", credentials: "include" })
    expect(JSON.parse(fetchMock.mock.calls[1][1].body as string)).toEqual({
      content: "hello",
      mediaKeys: ["tweets/k.png"],
    })
  })

  it("posts text alone without an upload or mediaKeys", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json(201, tweet("t1")))
    vi.stubGlobal("fetch", fetchMock)

    await postTweet({ content: "hello", image: null })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({ content: "hello" })
  })

  it("shows the API's reason when it rejects the image, and posts nothing", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(400, { error: "a.png is not a supported image type (jpeg, png, webp, gif)" }))
    vi.stubGlobal("fetch", fetchMock)

    const error = await postTweet({ content: "hi", image: png() }).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(PostTweetError)
    expect((error as Error).message).toBe(
      "That image can't be used: a.png is not a supported image type (jpeg, png, webp, gif)"
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("falls back to a general message for anything but a 400 with a reason", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response("oops", { status: 500 })))

    await expect(postTweet({ content: "hi", image: null })).rejects.toThrow(MESSAGES.failed)
  })
})
