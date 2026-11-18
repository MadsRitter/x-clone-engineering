import { formatRelativeTime } from "@/lib/format-relative-time"
import { formatHandle } from "@/lib/user"
import { cn } from "@/lib/utils"
import type { Tweet } from "@/queries/timeline"

export function TweetCard({ tweet }: { tweet: Tweet }) {
  const posted = new Date(tweet.createdAt)

  return (
    <article
      data-tweet-id={tweet.id}
      aria-labelledby={`tweet-${tweet.id}-author`}
      className="flex flex-col gap-1 border-b border-border px-4 py-3"
    >
      <header className="flex min-w-0 items-baseline gap-1 text-sm">
        <span id={`tweet-${tweet.id}-author`} className="truncate font-bold">
          {tweet.author.name}
        </span>
        <span className="truncate text-muted-foreground">
          {formatHandle(tweet.author.handle)}
        </span>
        <span aria-hidden className="text-muted-foreground">
          ·
        </span>
        <time
          dateTime={tweet.createdAt}
          title={posted.toLocaleString()}
          className="shrink-0 text-muted-foreground"
        >
          {formatRelativeTime(tweet.createdAt)}
        </time>
      </header>
      {tweet.content && (
        <p className="whitespace-pre-wrap break-words">{tweet.content}</p>
      )}
      {tweet.mediaUrls.length > 0 && (
        <div
          className={cn(
            "mt-2 grid gap-0.5 overflow-hidden rounded-2xl border border-border",
            tweet.mediaUrls.length > 1 && "grid-cols-2"
          )}
        >
          {tweet.mediaUrls.map((url, i) => (
            <img
              key={url}
              src={url}
              alt={`Image ${(i + 1).toString()} of ${tweet.mediaUrls.length.toString()} from ${tweet.author.name}`}
              loading="lazy"
              className="max-h-[510px] w-full bg-muted object-cover"
            />
          ))}
        </div>
      )}
    </article>
  )
}
