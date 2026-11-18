import { infiniteQueryOptions, type InfiniteData } from "@tanstack/react-query"

export type Tweet = {
  id: string
  authorId: string
  author: { name: string; handle: string }
  content: string
  mediaUrls: string[]
  createdAt: string
  likeCount: number
  retweetCount: number
  replyCount: number
  likedByMe: boolean
  retweetedByMe: boolean
}

export type TimelinePage = {
  items: Tweet[]
  nextCursor: string | null
}

export const TIMELINE_PAGE_SIZE = 20

export function timelineUrl(cursor?: string | null): string {
  const params = new URLSearchParams({ limit: String(TIMELINE_PAGE_SIZE) })
  if (cursor) params.set("cursor", cursor)
  return `/api/timeline?${params.toString()}`
}

/**
 * The loaded pages as one list. A tweet can show up on two pages when new ones are posted
 * between page loads, so only its first appearance is kept.
 */
export function flattenTimeline(data: InfiniteData<TimelinePage> | undefined): Tweet[] {
  const seen = new Set<string>()
  const tweets: Tweet[] = []
  for (const page of data?.pages ?? []) {
    for (const tweet of page.items) {
      if (seen.has(tweet.id)) continue
      seen.add(tweet.id)
      tweets.push(tweet)
    }
  }
  return tweets
}

export const timelineQueryOptions = infiniteQueryOptions({
  queryKey: ["timeline"] as const,
  queryFn: async ({ pageParam, signal }): Promise<TimelinePage> => {
    const res = await fetch(timelineUrl(pageParam), { credentials: "include", signal })
    if (!res.ok) throw new Error(`Couldn't load the timeline (${res.status.toString()})`)
    return (await res.json()) as TimelinePage
  },
  initialPageParam: null as string | null,
  getNextPageParam: (lastPage) => lastPage.nextCursor,
})
