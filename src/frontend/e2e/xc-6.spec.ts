import type { Page, PlaywrightWorkerArgs } from "@playwright/test"
import { randomBytes } from "node:crypto"

import { expect, test } from "./fixtures"

// XC-6 — Sign in. The sign-in screen only shows to signed-out visitors, so this spec's pages
// start signed out (an empty storage state — the saved sign-in is never loaded or touched).
// Each test signs up its own throwaway account on the shared API, from a separate client, so
// there is a real email and password to sign in with. example.test never receives mail.
test.use({ storageState: { cookies: [], origins: [] } })

const SIGN_IN_PATH = "/api/auth/sign-in/email"
const WRONG_DETAILS = "Incorrect email or password."

function newAccount() {
  const id = `${Date.now().toString(36)}${randomBytes(3).toString("hex")}`
  return {
    name: `XC-6 test ${id}`,
    email: `e2e-xc6-${id}@example.test`,
    password: `pw-${randomBytes(9).toString("base64url")}`,
  }
}

type Account = ReturnType<typeof newAccount>

async function createAccount(
  playwright: PlaywrightWorkerArgs["playwright"],
  baseURL: string | undefined
) {
  const account = newAccount()
  const api = await playwright.request.newContext({ baseURL })
  const res = await api.post("/api/auth/sign-up/email", { data: account })
  expect(res.ok()).toBe(true)
  await api.dispose()
  return account
}

async function fillSignIn(page: Page, details: Pick<Account, "email" | "password">) {
  await page.getByLabel("Email").fill(details.email)
  await page.getByLabel("Password").fill(details.password)
}

// The home timeline once it has loaded: the feed of tweets, or — for an account whose timeline
// has nothing in it yet, like a brand-new one — XC-8's empty message. Not the loading or error state.
const homeTimeline = (page: Page) =>
  page
    .getByRole("feed", { name: "Home timeline" })
    .or(page.getByRole("main").getByText("No tweets yet.", { exact: true }))

async function sessionOf(page: Page) {
  const res = await page.request.get("/api/auth/get-session")
  expect(res.ok()).toBe(true)
  return (await res.json()) as { user: { email: string } } | null
}

test.describe("XC-6: Sign in", () => {
  test("AC1: I can sign in by entering my email and password", async ({
    page,
    playwright,
    baseURL,
    evidence,
  }) => {
    const account = await createAccount(playwright, baseURL)

    await evidence.step("Open the sign-in screen while signed out", async () => {
      await page.goto("/sign-in")
      await expect(page.getByRole("heading", { name: "Sign in to X Clone" })).toBeVisible()
      expect(await sessionOf(page)).toBeNull()
    })
    await evidence.step("Enter my email and password", async () => {
      await fillSignIn(page, account)
    })
    await evidence.step("Sign in: the API accepts my details", async () => {
      const [response] = await Promise.all([
        page.waitForResponse((r) => r.url().endsWith(SIGN_IN_PATH)),
        page.getByRole("button", { name: "Sign in" }).click(),
      ])
      expect(response.ok()).toBe(true)
    })
    await evidence.step("I now have a session for my account", async () => {
      await expect.poll(async () => (await sessionOf(page))?.user.email).toBe(account.email)
    })
  })

  test("AC2: After signing in, I am taken to the home timeline", async ({
    page,
    playwright,
    baseURL,
    evidence,
  }) => {
    const account = await createAccount(playwright, baseURL)

    await evidence.step("Sign in with my email and password", async () => {
      await page.goto("/sign-in")
      await fillSignIn(page, account)
      await page.getByRole("button", { name: "Sign in" }).click()
    })
    await evidence.step("I land on the home timeline, signed in as me", async () => {
      await expect(page).toHaveURL(/\/$/)
      await expect(homeTimeline(page)).toBeVisible()
      await expect(page.getByRole("heading", { name: `Welcome, ${account.name}!` })).toBeVisible()
      await expect(page.getByRole("button", { name: /^Sign out/ })).toBeVisible()
    })
    await evidence.step("Reloading keeps me on the timeline, still signed in", async () => {
      await page.reload()
      await expect(page).toHaveURL(/\/$/)
      await expect(homeTimeline(page)).toBeVisible()
    })
  })

  test("AC3: If my email or password is wrong, I see a clear message and stay signed out", async ({
    page,
    playwright,
    baseURL,
    evidence,
  }) => {
    const account = await createAccount(playwright, baseURL)

    await evidence.step("Sign in with my email but the wrong password", async () => {
      await page.goto("/sign-in")
      await fillSignIn(page, { email: account.email, password: `${account.password}-wrong` })
      const [response] = await Promise.all([
        page.waitForResponse((r) => r.url().endsWith(SIGN_IN_PATH)),
        page.getByRole("button", { name: "Sign in" }).click(),
      ])
      expect(response.ok()).toBe(false)
    })
    await evidence.step("A clear message says the details are wrong, and I stay signed out", async () => {
      await expect(page.getByRole("alert")).toHaveText(WRONG_DETAILS)
      await expect(page).toHaveURL(/\/sign-in$/)
      expect(await sessionOf(page)).toBeNull()
    })

    await evidence.step("Sign in with an email that has no account", async () => {
      await fillSignIn(page, { email: `nobody-${account.email}`, password: account.password })
      const [response] = await Promise.all([
        page.waitForResponse((r) => r.url().endsWith(SIGN_IN_PATH)),
        page.getByRole("button", { name: "Sign in" }).click(),
      ])
      expect(response.ok()).toBe(false)
    })
    await evidence.step("The same message shows, and I am still signed out", async () => {
      await expect(page.getByRole("alert")).toHaveText(WRONG_DETAILS)
      await expect(page).toHaveURL(/\/sign-in$/)
      expect(await sessionOf(page)).toBeNull()
    })

    await evidence.step("Opening the app still sends me to sign in", async () => {
      await page.goto("/")
      await expect(page).toHaveURL(/\/sign-in$/)
    })
  })
})
