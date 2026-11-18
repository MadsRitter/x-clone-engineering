import type { Page } from "@playwright/test"

import { expect, test } from "./fixtures"

// XC-7 — Keep the app behind sign-in. Every page here is signed out (an empty storage state —
// the saved sign-in is never loaded, and Sign out is never clicked). Nothing is created on the
// shared API.
test.use({ storageState: { cookies: [], origins: [] } })

const SIGN_IN_HEADING = "Sign in to X Clone"
const SIGN_UP_HEADING = "Create your account"

// Pages a signed-out visitor might open: the home timeline, a deep link with a query and hash,
// and paths the app doesn't have.
const OTHER_PAGES = ["/", "/?tab=latest#top", "/settings", "/tweets/123", "/does/not/exist"]

// What only a signed-in person should see: the app's header and the timeline.
async function expectNoAppContent(page: Page) {
  await expect(page.getByRole("button", { name: /^Sign out/ })).toHaveCount(0)
  await expect(page.getByRole("heading", { name: /^Welcome/ })).toHaveCount(0)
  await expect(page.getByRole("feed", { name: "Home timeline" })).toHaveCount(0)
  await expect(page.getByText("No tweets yet.", { exact: true })).toHaveCount(0)
}

// Requests the app makes to the API for anything but checking who is signed in.
function trackPrivateApiCalls(page: Page) {
  const calls: string[] = []
  page.on("request", (r) => {
    const { pathname } = new URL(r.url())
    if (pathname.startsWith("/api/") && !pathname.startsWith("/api/auth/")) calls.push(pathname)
  })
  return calls
}

test.describe("XC-7: Keep the app behind sign-in", () => {
  test("AC1: When I am not signed in, I can only see the sign-in and sign-up screens", async ({
    page,
    evidence,
  }) => {
    const privateCalls = trackPrivateApiCalls(page)

    await evidence.step("Open the sign-in screen while signed out: it shows", async () => {
      await page.goto("/sign-in")
      await expect(page).toHaveURL(/\/sign-in$/)
      await expect(page.getByRole("heading", { name: SIGN_IN_HEADING })).toBeVisible()
      await expectNoAppContent(page)
    })
    await evidence.step("Follow the link to sign up: the sign-up screen shows", async () => {
      await page.getByRole("link", { name: "Sign up" }).click()
      await expect(page).toHaveURL(/\/sign-up$/)
      await expect(page.getByRole("heading", { name: SIGN_UP_HEADING })).toBeVisible()
      await expectNoAppContent(page)
    })
    await evidence.step("Follow the link back to sign in", async () => {
      await page.getByRole("link", { name: "Sign in" }).click()
      await expect(page).toHaveURL(/\/sign-in$/)
      await expect(page.getByRole("heading", { name: SIGN_IN_HEADING })).toBeVisible()
    })
    await evidence.step("Every other page I try shows the sign-in screen, never the app", async () => {
      for (const path of OTHER_PAGES) {
        await page.goto(path)
        await expect(page.getByRole("heading", { name: SIGN_IN_HEADING })).toBeVisible()
        await expectNoAppContent(page)
      }
    })
    await evidence.step("The app never asked the API for anything private", async () => {
      expect(privateCalls).toEqual([])
    })
  })

  test("AC2: If I open any other page while signed out, I am sent to the sign-in screen", async ({
    page,
    evidence,
  }) => {
    for (const path of OTHER_PAGES) {
      await evidence.step(`Open ${path} while signed out: I am sent to sign in`, async () => {
        await page.goto(path)
        await expect(page).toHaveURL(/\/sign-in$/)
        await expect(page.getByRole("heading", { name: SIGN_IN_HEADING })).toBeVisible()
        await expectNoAppContent(page)
      })
    }
    await evidence.step("Going back doesn't reveal the page I was sent away from", async () => {
      await page.goBack()
      await expect(page.getByRole("heading", { name: SIGN_IN_HEADING })).toBeVisible()
      await expectNoAppContent(page)
    })
  })
})
