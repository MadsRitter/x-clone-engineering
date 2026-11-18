import type { Page, Request } from "@playwright/test"
import { randomBytes } from "node:crypto"

import { expect, test } from "./fixtures"

// XC-9 — Post a tweet. Runs signed in with the saved sign-in, and posts through the real form to
// the shared API. The API has no delete, so each run leaves two short "XC-9 e2e" tweets (one with
// a tiny image) on that account. The tests that check what can't be posted never reach the API.
//
// The story leaves the limits "Not known yet"; these are the shared API's own rules, read from
// its error responses: text at most 280 characters, images JPEG/PNG/WebP/GIF of at most 5 MB
// (checked by their bytes), and a tweet needs text or an image.

const MAX_LENGTH = 280

// A 48×48 blue PNG: the API sniffs the file's bytes, so it has to be a real image.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAIAAADYYG7QAAAAQklEQVR4nO3OQQ0AIAwAsRlBOSaRgAuOR5MK6Kx9vjL5QEhISKgeCAkJCdUDISEhoXogJCQkVA+EhISE6oGQkNBjF0/q6NMLL3wZAAAAAElFTkSuQmCC",
  "base64"
)

const runId = () => `${Date.now().toString(36)}${randomBytes(2).toString("hex")}`

const composer = (page: Page) => page.getByRole("form", { name: "Post a tweet" })
const textbox = (page: Page) => composer(page).getByRole("textbox", { name: "What's happening?" })
const postButton = (page: Page) => composer(page).getByRole("button", { name: "Post", exact: true })
const imageInput = (page: Page) => composer(page).getByLabel("Add image")
const firstTweet = (page: Page) =>
  page.getByRole("feed", { name: "Home timeline" }).getByRole("article").first()

const isCreateTweet = (r: Request) =>
  r.method() === "POST" && new URL(r.url()).pathname === "/api/tweets"
const isUpload = (r: Request) =>
  r.method() === "POST" && new URL(r.url()).pathname === "/api/upload"

// Requests that would post or upload something. The "can't post" tests expect none.
function trackWrites(page: Page) {
  const writes: string[] = []
  page.on("request", (r) => {
    if (isCreateTweet(r) || isUpload(r)) writes.push(new URL(r.url()).pathname)
  })
  return writes
}

async function openHome(page: Page) {
  await page.goto("/")
  await expect(composer(page)).toBeVisible()
}

async function post(page: Page) {
  const [response] = await Promise.all([
    page.waitForResponse((r) => isCreateTweet(r.request())),
    postButton(page).click(),
  ])
  expect(response.status(), await response.text()).toBe(201)
  return (await response.json()) as { id: string; content: string; mediaUrls: string[] }
}

test.describe("XC-9: Post a tweet", () => {
  test("AC1: I can type a tweet and post it, with or without one image", async ({
    page,
    evidence,
  }) => {
    const textOnly = `XC-9 e2e text ${runId()}`
    const withImage = `XC-9 e2e image ${runId()}`

    await evidence.step("Open the home timeline", async () => {
      await openHome(page)
    })
    await evidence.step("Type a tweet and post it", async () => {
      await textbox(page).fill(textOnly)
      const created = await post(page)
      expect(created.content).toBe(textOnly)
      expect(created.mediaUrls).toEqual([])
    })
    await evidence.step("The box is empty again, ready for the next one", async () => {
      await expect(textbox(page)).toHaveValue("")
    })
    await evidence.step("Type another tweet and attach one image", async () => {
      await textbox(page).fill(withImage)
      await imageInput(page).setInputFiles({ name: "xc-9.png", mimeType: "image/png", buffer: PNG })
      await expect(composer(page).getByRole("img", { name: "Image to post" })).toBeVisible()
    })
    await evidence.step("Post it: the tweet goes out with its image", async () => {
      const created = await post(page)
      expect(created.content).toBe(withImage)
      expect(created.mediaUrls).toHaveLength(1)
    })
    await evidence.step("The image is no longer attached in the box", async () => {
      await expect(textbox(page)).toHaveValue("")
      await expect(composer(page).getByRole("img", { name: "Image to post" })).toHaveCount(0)
    })
    await evidence.step("The tweet with the image shows it", async () => {
      await expect(firstTweet(page)).toContainText(withImage)
      await expect(firstTweet(page).getByRole("img")).toBeVisible()
    })
  })

  test("AC2: My new tweet appears at the top of my timeline straight away", async ({
    page,
    evidence,
  }) => {
    const content = `XC-9 e2e top ${runId()}`
    const timelineLoads: string[] = []

    await evidence.step("Open the home timeline", async () => {
      await openHome(page)
      await expect(firstTweet(page).or(page.getByText("No tweets yet.", { exact: true }))).toBeVisible()
    })
    page.on("request", (r) => {
      if (new URL(r.url()).pathname === "/api/timeline") timelineLoads.push(r.url())
    })
    await evidence.step("Post a new tweet", async () => {
      await textbox(page).fill(content)
      await post(page)
    })
    await evidence.step("It is at the top of my timeline at once, with no reload", async () => {
      await expect(firstTweet(page)).toContainText(content, { timeout: 1000 })
      expect(timelineLoads).toEqual([])
    })
    await evidence.step("After a reload it is still at the top: it really was posted", async () => {
      await page.reload()
      await expect(firstTweet(page)).toContainText(content)
    })
  })

  test("AC3: I cannot post an empty tweet", async ({ page, evidence }) => {
    const writes = trackWrites(page)

    await evidence.step("Open the home timeline: the box is empty and Post is off", async () => {
      await openHome(page)
      await expect(textbox(page)).toHaveValue("")
      await expect(postButton(page)).toBeDisabled()
    })
    await evidence.step("Only spaces and line breaks: Post stays off", async () => {
      await textbox(page).fill("   \n\n  ")
      await expect(postButton(page)).toBeDisabled()
    })
    await evidence.step("Pressing Ctrl+Enter in the box doesn't post either", async () => {
      await textbox(page).press("Control+Enter")
      await expect(textbox(page)).toHaveValue("   \n\n  ")
    })
    await evidence.step("Nothing was sent to the API", async () => {
      expect(writes).toEqual([])
    })
  })

  test("AC4: If the tweet is too long or the image is not allowed, I see a clear message", async ({
    page,
    evidence,
  }) => {
    const writes = trackWrites(page)
    const alert = composer(page).getByRole("alert")

    await evidence.step("Open the home timeline", async () => {
      await openHome(page)
    })
    await evidence.step(`Exactly ${MAX_LENGTH.toString()} characters is fine`, async () => {
      await textbox(page).fill("x".repeat(MAX_LENGTH))
      await expect(postButton(page)).toBeEnabled()
      await expect(alert).toHaveCount(0)
    })
    await evidence.step("One character more: a clear message, and Post is off", async () => {
      await textbox(page).fill("x".repeat(MAX_LENGTH + 1))
      await expect(alert).toHaveText(
        "Your tweet is 1 character too long. Tweets can be at most 280 characters."
      )
      await expect(postButton(page)).toBeDisabled()
    })
    await evidence.step("Shorten it: the message goes away", async () => {
      await textbox(page).fill("XC-9 e2e short enough")
      await expect(alert).toHaveCount(0)
      await expect(postButton(page)).toBeEnabled()
    })
    await evidence.step("Attach a file that isn't an image: a clear message", async () => {
      await imageInput(page).setInputFiles({
        name: "notes.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("hello"),
      })
      await expect(alert).toHaveText("That file can't be attached. Use a JPEG, PNG, WebP or GIF image.")
      await expect(composer(page).getByRole("img", { name: "Image to post" })).toHaveCount(0)
    })
    await evidence.step("Attach an image over 5 MB: a clear message", async () => {
      await imageInput(page).setInputFiles({
        name: "huge.png",
        mimeType: "image/png",
        buffer: Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]),
      })
      await expect(alert).toHaveText("That image is too big. Images can be at most 5 MB.")
      await expect(composer(page).getByRole("img", { name: "Image to post" })).toHaveCount(0)
    })
    await evidence.step("None of it was sent to the API", async () => {
      expect(writes).toEqual([])
    })
    await evidence.step("A file named .png that isn't really an image: the API's reason shows", async () => {
      await page.route("**/api/tweets", (route) => route.abort())
      await imageInput(page).setInputFiles({
        name: "fake.png",
        mimeType: "image/png",
        buffer: Buffer.from("not really a png"),
      })
      const [upload] = await Promise.all([
        page.waitForResponse((r) => isUpload(r.request())),
        postButton(page).click(),
      ])
      expect(upload.status()).toBe(400)
      await expect(alert).toHaveText(
        "That image can't be used: fake.png is not a supported image type (jpeg, png, webp, gif)"
      )
      await expect(textbox(page)).toHaveValue("XC-9 e2e short enough")
      expect(writes).toEqual(["/api/upload"])
    })
  })
})
