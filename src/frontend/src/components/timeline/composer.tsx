import { useEffect, useId, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon, ImageAdd01Icon } from "@hugeicons/core-free-icons"

import { Button, buttonVariants } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { timelineQueryOptions } from "@/queries/timeline"
import {
  canPost,
  IMAGE_TYPES,
  imageProblem,
  MESSAGES,
  PostTweetError,
  postTweetMutationOptions,
  prependTweet,
  tooLongMessage,
  TWEET_MAX_LENGTH,
} from "@/queries/tweets"

export function Composer() {
  const queryClient = useQueryClient()
  const inputId = useId()
  const [content, setContent] = useState("")
  // The attached image, with an object URL for its preview (released when it's replaced or gone).
  const [attached, setAttached] = useState<{ file: File; preview: string } | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)
  const image = attached?.file ?? null
  const preview = attached?.preview ?? null

  useEffect(() => {
    if (!preview) return
    return () => URL.revokeObjectURL(preview)
  }, [preview])

  const mutation = useMutation({
    ...postTweetMutationOptions,
    onSuccess: (tweet) => {
      // The new tweet goes straight to the top; no reload of the timeline needed.
      const { queryKey } = timelineQueryOptions
      if (queryClient.getQueryData(queryKey)) {
        queryClient.setQueryData(queryKey, (data) => prependTweet(data, tweet))
      } else {
        void queryClient.invalidateQueries({ queryKey })
      }
      setContent("")
      setAttached(null)
    },
  })

  const tooLong = tooLongMessage(content)
  const postError = mutation.error
    ? mutation.error instanceof PostTweetError
      ? mutation.error.message
      : MESSAGES.failed
    : null
  const message = tooLong ?? imageError ?? postError
  const ready = canPost(content, image) && !mutation.isPending

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    if (ready) mutation.mutate({ content, image })
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(e)
  }

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = "" // so picking the same file again still fires
    if (!file) return
    mutation.reset()
    const problem = imageProblem(file)
    setImageError(problem)
    setAttached(problem ? null : { file, preview: URL.createObjectURL(file) })
  }

  const remaining = TWEET_MAX_LENGTH - content.trim().length

  return (
    <form
      aria-label="Post a tweet"
      onSubmit={submit}
      className="flex flex-col gap-2 rounded-lg border border-border p-4"
    >
      <Textarea
        aria-label="What's happening?"
        placeholder="What's happening?"
        value={content}
        onChange={(e) => {
          mutation.reset()
          setContent(e.target.value)
        }}
        onKeyDown={onKeyDown}
        aria-invalid={tooLong ? true : undefined}
        disabled={mutation.isPending}
      />

      {preview && (
        <div className="relative w-fit">
          <img
            src={preview}
            alt="Image to post"
            className="max-h-64 rounded-2xl border border-border object-cover"
          />
          <Button
            type="button"
            variant="secondary"
            size="icon-sm"
            className="absolute top-2 right-2 rounded-full"
            aria-label="Remove image"
            disabled={mutation.isPending}
            onClick={() => setAttached(null)}
          >
            <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
          </Button>
        </div>
      )}

      {message && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {message}
        </p>
      )}

      <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
        <label
          htmlFor={inputId}
          title="Add image"
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon" }),
            "cursor-pointer text-primary",
            (image || mutation.isPending) && "pointer-events-none opacity-50"
          )}
        >
          <HugeiconsIcon icon={ImageAdd01Icon} className="size-5" />
          <span className="sr-only">Add image</span>
        </label>
        <input
          id={inputId}
          type="file"
          accept={IMAGE_TYPES.join(",")}
          className="sr-only"
          onChange={onPick}
          disabled={image !== null || mutation.isPending}
        />
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className={cn("text-sm tabular-nums text-muted-foreground", remaining < 0 && "text-destructive")}
          >
            {remaining.toString()}
          </span>
          <Button type="submit" className="rounded-full px-4" disabled={!ready}>
            {mutation.isPending ? "Posting…" : "Post"}
          </Button>
        </div>
      </div>
    </form>
  )
}
