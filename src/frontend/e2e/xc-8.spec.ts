import type { APIRequestContext, Page } from "@playwright/test"
import { randomBytes } from "node:crypto"

import { expect, test } from "./fixtures"

// XC-8 — Scroll the home timeline. Runs signed in with the saved sign-in.
//
// The timeline comes from the shared API's GET /api/timeline, which returns the signed-in
// account's own tweets plus those of the people it follows (the API has no all-users feed, and
// following is out of scope for v1). So the tests that need tweets post their own, as the
// signed-in account, through the dev server's /api proxy. The API has no delete, so each run
// leaves a few short "XC-8 e2e" tweets on that account.

const TIMELINE = "**/api/timeline?**"

// The names a manual paging control would have. Phrases, not single words, so an unrelated
// control such as "Load image" or "More options" doesn't count.
const PAGING_CONTROL =
  /^(next|older|more)$|next page|previous page|load more|show more|more tweets|older tweets|page \d/i

// A 48×48 blue PNG: the API sniffs the file's bytes, so it has to be a real image.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAIAAADYYG7QAAAAQklEQVR4nO3OQQ0AIAwAsRlBOSaRgAuOR5MK6Kx9vjL5QEhISKgeCAkJCdUDISEhoXogJCQkVA+EhISE6oGQkNBjF0/q6NMLL3wZAAAAAElFTkSuQmCC",
  "base64"
)

type Tweet = {
  id: string
  author: { name: string; handle: string }
  content: string
  mediaUrls: string[]
  createdAt: string
}

const runId = () => `${Date.now().toString(36)}${randomBytes(2).toString("hex")}`

async function postTweet(api: APIRequestContext, content: string, mediaKeys?: string[]) {
  const res = await api.post("/api/tweets", { data: { content, ...(mediaKeys ? { mediaKeys } : {}) } })
  expect(res.status(), await res.text()).toBe(201)
  return (await res.json()) as Tweet
}

async function uploadImage(api: APIRequestContext) {
  const res = await api.post("/api/upload", {
    multipart: { files: { name: "xc-8.png", mimeType: "image/png", buffer: PNG } },
  })
  expect(res.ok(), await res.text()).toBe(true)
  return ((await res.json()) as { keys: string[] }).keys
}

const timeline = (page: Page) => page.getByRole("feed", { name: "Home timeline" })
const tweets = (page: Page) => timeline(page).getByRole("article")

test.describe("XC-8: Scroll the home timeline", () => {
  test("AC1: The home timeline shows tweets, newest first", async ({ page, evidence }) => {
    const id = runId()
    const older = `XC-8 e2e ${id}: posted first`
    const newer = `XC-8 e2e ${id}: posted second`

    await evidence.step("Two tweets are posted, one after the other", async () => {
      await postTweet(page.request, older)
      await postTweet(page.request, newer)
    })
    await evidence.step("Open the home timeline", async () => {
      await page.goto("/")
      await expect(tweets(page).first()).toBeVisible()
    })
    await evidence.step("The newer tweet is above the older one", async () => {
      const texts = await tweets(page).allInnerTexts()
      const iNewer = texts.findIndex((t) => t.includes(newer))
      const iOlder = texts.findIndex((t) => t.includes(older))
      expect(iNewer).toBeGreaterThanOrEqual(0)
      expect(iOlder).toBeGreaterThan(iNewer)
    })
    await evidence.step("Every tweet on screen is newer than the one below it", async () => {
      const times = await tweets(page)
        .locator("time")
        .evaluateAll((els) => els.map((el) => Date.parse(el.getAttribute("datetime") ?? "")))
      expect(times.length).toBeGreaterThanOrEqual(2)
      expect(times.every((t) => !Number.isNaN(t))).toBe(true)
      expect(times).toEqual([...times].sort((a, b) => b - a))
    })
    await evidence.step("The timeline shows what the API returns, in the same order", async () => {
      const res = await page.request.get("/api/timeline?limit=5")
      const { items } = (await res.json()) as { items: Tweet[] }
      const shown = await tweets(page).allInnerTexts()
      items.forEach((item, i) => expect(shown[i]).toContain(item.content))
    })
  })

  test("AC2: More tweets load automatically as I scroll, with no \"next page\" button", async ({
    page,
    evidence,
  }) => {
    const PAGE = 6

    await evidence.step("There are more tweets than fit on one page", async () => {
      const res = await page.request.get(`/api/timeline?limit=${PAGE + 1}`)
      const { items } = (await res.json()) as { items: Tweet[] }
      const id = runId()
      for (let i = items.length; i <= PAGE; i++) await postTweet(page.request, `XC-8 e2e ${id}: filler ${i}`)
    })

    // Small pages and a short window, so the first page fills the screen and the next page
    // can only come from scrolling. The requests still go to the real API, with its cursors.
    const requests: URL[] = []
    await page.setViewportSize({ width: 1280, height: 400 })
    await page.route(TIMELINE, async (route) => {
      const url = new URL(route.request().url())
      url.searchParams.set("limit", String(PAGE))
      requests.push(url)
      await route.continue({ url: url.toString() })
    })

    await evidence.step("Open the home timeline: the first page shows", async () => {
      await page.goto("/")
      await expect(tweets(page)).toHaveCount(PAGE)
      // Dev StrictMode may ask for the first page twice; what matters is that no later page
      // (a request with a cursor) was asked for before scrolling.
      expect(requests.length).toBeGreaterThanOrEqual(1)
      expect(requests.filter((u) => u.searchParams.has("cursor"))).toHaveLength(0)
    })
    await evidence.step("There is no \"next page\" or \"load more\" button", async () => {
      await expect(page.getByRole("button", { name: PAGING_CONTROL })).toHaveCount(0)
      await expect(page.getByRole("link", { name: PAGING_CONTROL })).toHaveCount(0)
    })
    await evidence.step("Scroll down: more tweets load by themselves", async () => {
      await tweets(page).last().scrollIntoViewIfNeeded()
      await page.mouse.wheel(0, 2000)
      await expect.poll(() => tweets(page).count()).toBeGreaterThan(PAGE)
      expect(requests.filter((u) => u.searchParams.get("cursor"))).not.toHaveLength(0)
    })
    await evidence.step("The new tweets continue the timeline: no repeats, still newest first", async () => {
      const ids = await tweets(page).evaluateAll((els) => els.map((el) => el.getAttribute("data-tweet-id")))
      expect(new Set(ids).size).toBe(ids.length)
      const times = await tweets(page)
        .locator("time")
        .evaluateAll((els) => els.map((el) => Date.parse(el.getAttribute("datetime") ?? "")))
      expect(times).toEqual([...times].sort((a, b) => b - a))
    })
  })

  test("AC3: Each tweet shows the author's name and handle, when it was posted, the text, and the image if there is one", async ({
    page,
    evidence,
  }) => {
    const id = runId()
    let withImage!: Tweet
    let textOnly!: Tweet

    await evidence.step("Post a tweet with an image, and one with text only", async () => {
      withImage = await postTweet(page.request, `XC-8 e2e ${id}: with a picture`, await uploadImage(page.request))
      textOnly = await postTweet(page.request, `XC-8 e2e ${id}: just text`)
      expect(withImage.mediaUrls).toHaveLength(1)
    })
    await evidence.step("Open the home timeline", async () => {
      await page.goto("/")
    })

    const handle = (t: Tweet) => `@${t.author.handle.replace(/^@/, "")}`
    const card = (t: Tweet) => tweets(page).filter({ hasText: t.content })

    await evidence.step("The tweet shows its author's name and handle", async () => {
      await expect(card(withImage)).toHaveCount(1)
      await expect(card(withImage).getByText(withImage.author.name, { exact: true })).toBeVisible()
      await expect(card(withImage).getByText(handle(withImage), { exact: true })).toBeVisible()
    })
    await evidence.step("It shows when it was posted", async () => {
      const time = card(withImage).locator("time")
      await expect(time).toBeVisible()
      await expect(time).toHaveAttribute("datetime", withImage.createdAt)
      // Compact relative form ("5s", "3m"…). This holds because the tweet was posted moments
      // ago: past a week the card shows a date instead (see formatRelativeTime).
      await expect(time).toHaveText(/^\d+[smhd]$/)
    })
    await evidence.step("It shows the text", async () => {
      await expect(card(withImage).getByText(withImage.content, { exact: true })).toBeVisible()
    })
    await evidence.step("It shows the image, loaded", async () => {
      const img = card(withImage).getByRole("img")
      await expect(img).toHaveCount(1)
      await expect(img).toHaveAttribute("src", withImage.mediaUrls[0])
      await expect(img).toBeVisible()
      await expect.poll(() => img.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
    })
    await evidence.step("A tweet without an image shows the same details and no image", async () => {
      await expect(card(textOnly).getByText(textOnly.author.name, { exact: true })).toBeVisible()
      await expect(card(textOnly).getByText(handle(textOnly), { exact: true })).toBeVisible()
      await expect(card(textOnly).locator("time")).toHaveAttribute("datetime", textOnly.createdAt)
      await expect(card(textOnly).getByText(textOnly.content, { exact: true })).toBeVisible()
      await expect(card(textOnly).getByRole("img")).toHaveCount(0)
    })
  })

  test("AC4: If there are no tweets yet, I see a simple empty message", async ({ page, evidence }) => {
    // The signed-in account has tweets by now, so the API is asked for an empty timeline here:
    // an account with no tweets and no follows gets exactly this response.
    await page.route(TIMELINE, (route) =>
      route.fulfill({ json: { items: [], nextCursor: null } })
    )

    await evidence.step("Open the home timeline when there are no tweets", async () => {
      await page.goto("/")
    })
    await evidence.step("A simple message says there are no tweets yet", async () => {
      await expect(page.getByText("No tweets yet")).toBeVisible()
      await expect(page.getByRole("article")).toHaveCount(0)
    })
  })
})
