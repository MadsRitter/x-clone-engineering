import { useCallback } from "react"
import { useInfiniteQuery } from "@tanstack/react-query"

import { TweetCard } from "@/components/timeline/tweet-card"
import { Button } from "@/components/ui/button"
import { useOnVisible } from "@/hooks/use-on-visible"
import { flattenTimeline, timelineQueryOptions } from "@/queries/timeline"

export function Timeline() {
  const {
    data,
    status,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
  } = useInfiniteQuery(timelineQueryOptions)

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  // Infinite scroll: the next page starts loading as the end of the list comes into view.
  const sentinel = useOnVisible<HTMLDivElement>(loadMore, {
    enabled: hasNextPage && !isFetchingNextPage && !isFetchNextPageError,
    rootMargin: "0px 0px 100px 0px",
  })

  if (status === "pending") {
    return <p className="px-4 py-8 text-center text-muted-foreground">Loading tweets…</p>
  }

  // Only a failed first load replaces the list; a failed later page keeps what's shown.
  if (!data) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 px-4 py-8 text-center">
        <p className="text-muted-foreground">Couldn't load the timeline.</p>
        <Button type="button" variant="outline" onClick={() => void refetch()}>
          Try again
        </Button>
      </div>
    )
  }

  const tweets = flattenTimeline(data)

  if (tweets.length === 0) {
    return (
      <p className="px-4 py-12 text-center text-muted-foreground">
        No tweets yet.
      </p>
    )
  }

  return (
    <div>
      <div
        role="feed"
        aria-label="Home timeline"
        aria-busy={isFetchingNextPage}
        className="border-t border-border"
      >
        {tweets.map((tweet) => (
          <TweetCard key={tweet.id} tweet={tweet} />
        ))}
      </div>
      <div ref={sentinel} aria-hidden className="h-px" />
      {isFetchingNextPage && (
        <p className="py-4 text-center text-sm text-muted-foreground">Loading…</p>
      )}
      {isFetchNextPageError && (
        <div role="alert" className="flex flex-col items-center gap-2 py-4 text-sm">
          <p className="text-muted-foreground">Couldn't load older tweets.</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void fetchNextPage()}>
            Try again
          </Button>
        </div>
      )}
    </div>
  )
}
