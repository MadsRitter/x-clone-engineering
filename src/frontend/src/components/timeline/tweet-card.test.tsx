import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { TweetCard } from "@/components/timeline/tweet-card"
import type { Tweet } from "@/queries/timeline"

function tweet(overrides: Partial<Tweet> = {}): Tweet {
  return {
    id: "t1",
    authorId: "u1",
    author: { name: "Ada Lovelace", handle: "@ada" },
    content: "Hello, timeline",
    mediaUrls: [],
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    likeCount: 0,
    retweetCount: 0,
    replyCount: 0,
    likedByMe: false,
    retweetedByMe: false,
    ...overrides,
  }
}

describe("TweetCard", () => {
  it("shows the author's name and handle, when it was posted, and the text", () => {
    const t = tweet()
    render(<TweetCard tweet={t} />)

    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument()
    expect(screen.getByText("@ada")).toBeInTheDocument()
    const time = screen.getByText("5m")
    expect(time.tagName).toBe("TIME")
    expect(time).toHaveAttribute("datetime", t.createdAt)
    expect(screen.getByText("Hello, timeline")).toBeInTheDocument()
    expect(screen.queryByRole("img")).not.toBeInTheDocument()
  })

  it("shows the image of an image-only tweet, with the author and time, and no empty text", () => {
    const t = tweet({ content: "", mediaUrls: ["https://cdn.example.test/a.png"] })
    const { container } = render(<TweetCard tweet={t} />)

    expect(screen.getByRole("img")).toHaveAttribute("src", "https://cdn.example.test/a.png")
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument()
    expect(screen.getByText("@ada")).toBeInTheDocument()
    expect(container.querySelector("time")).toHaveAttribute("datetime", t.createdAt)
    expect(container.querySelector("p")).toBeNull()
  })

  it("shows every image when a tweet has several", () => {
    const urls = ["https://cdn.example.test/a.png", "https://cdn.example.test/b.png"]
    render(<TweetCard tweet={tweet({ mediaUrls: urls })} />)

    expect(screen.getAllByRole("img").map((img) => img.getAttribute("src"))).toEqual(urls)
  })
})
