import { mutationOptions, type InfiniteData } from "@tanstack/react-query"

import type { TimelinePage, Tweet } from "@/queries/timeline"

// The shared API's own limits (read from its error responses; the PRD leaves them open).
export const TWEET_MAX_LENGTH = 280
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const

export const MESSAGES = {
  notAnImage: "That file can't be attached. Use a JPEG, PNG, WebP or GIF image.",
  imageTooBig: "That image is too big. Images can be at most 5 MB.",
  failed: "Your tweet couldn't be posted. Please try again.",
}

export function tooLongMessage(content: string): string | null {
  const over = content.trim().length - TWEET_MAX_LENGTH
  if (over <= 0) return null
  const chars = over === 1 ? "character" : "characters"
  return `Your tweet is ${over.toString()} ${chars} too long. Tweets can be at most ${TWEET_MAX_LENGTH.toString()} characters.`
}

/** Why this file can't be attached, or null if it can. */
export function imageProblem(file: Pick<File, "type" | "size">): string | null {
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) return MESSAGES.notAnImage
  if (file.size > IMAGE_MAX_BYTES) return MESSAGES.imageTooBig
  return null
}

/** A tweet can be posted when it has text or an image, and the text isn't too long. */
export function canPost(content: string, image: File | null): boolean {
  return (content.trim().length > 0 || image !== null) && tooLongMessage(content) === null
}

/** An error whose message is fit to show the person as it is. */
export class PostTweetError extends Error {}

async function apiError(res: Response, prefix: string): Promise<PostTweetError> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null
  if (res.status === 400 && body?.error) return new PostTweetError(`${prefix}${body.error}`)
  return new PostTweetError(MESSAGES.failed)
}

async function uploadImage(image: File): Promise<string[]> {
  const form = new FormData()
  form.append("files", image)
  const res = await fetch("/api/upload", { method: "POST", body: form, credentials: "include" })
  if (!res.ok) throw await apiError(res, "That image can't be used: ")
  return ((await res.json()) as { keys: string[] }).keys
}

export type NewTweet = { content: string; image: File | null }

export async function postTweet({ content, image }: NewTweet): Promise<Tweet> {
  const mediaKeys = image ? await uploadImage(image) : undefined
  const res = await fetch("/api/tweets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: content.trim(), ...(mediaKeys ? { mediaKeys } : {}) }),
    credentials: "include",
  })
  if (!res.ok) throw await apiError(res, "")
  return (await res.json()) as Tweet
}

export const postTweetMutationOptions = mutationOptions({
  mutationKey: ["tweets", "post"] as const,
  mutationFn: postTweet,
})

/** The timeline with this tweet at the very top (the newest), and nowhere else. */
export function prependTweet(
  data: InfiniteData<TimelinePage> | undefined,
  tweet: Tweet
): InfiniteData<TimelinePage> | undefined {
  if (!data || data.pages.length === 0) return data
  const [first, ...rest] = data.pages
  return {
    ...data,
    pages: [
      { ...first, items: [tweet, ...first.items.filter((t) => t.id !== tweet.id)] },
      ...rest,
    ],
  }
}
