import type { Page, PlaywrightWorkerArgs } from "@playwright/test"
import { randomBytes } from "node:crypto"

import { expect, test } from "./fixtures"

// XC-5 — Sign up. The sign-up screen only shows to signed-out visitors, so this spec's pages
// start signed out (an empty storage state — the saved sign-in is never loaded or touched).
// Each run signs up throwaway accounts on the shared API with generated details; example.test
// is a reserved domain that never receives mail.
test.use({ storageState: { cookies: [], origins: [] } })

const SIGN_UP_PATH = "/api/auth/sign-up/email"

function newAccount() {
  const id = `${Date.now().toString(36)}${randomBytes(3).toString("hex")}`
  return {
    name: `XC-5 test ${id}`,
    email: `e2e-xc5-${id}@example.test`,
    password: `pw-${randomBytes(9).toString("base64url")}`,
  }
}

type Account = ReturnType<typeof newAccount>

async function fillSignUp(page: Page, account: Account) {
  await page.getByLabel("Name").fill(account.name)
  await page.getByLabel("Email").fill(account.email)
  await page.getByLabel("Password", { exact: true }).fill(account.password)
  await page.getByLabel("Confirm password").fill(account.password)
}

// Checks credentials from a separate, cookie-less client, so the page under test keeps its own
// signed-in or signed-out state.
async function canSignIn(
  playwright: PlaywrightWorkerArgs["playwright"],
  baseURL: string | undefined,
  account: Pick<Account, "email" | "password">
) {
  const api = await playwright.request.newContext({ baseURL })
  const res = await api.post("/api/auth/sign-in/email", {
    data: { email: account.email, password: account.password },
  })
  await api.dispose()
  return res.ok()
}

test.describe("XC-5: Sign up", () => {
  test("AC1: I can create an account by entering an email and a password", async ({
    page,
    playwright,
    baseURL,
    evidence,
  }) => {
    const account = newAccount()

    await evidence.step("Open the sign-up screen while signed out", async () => {
      await page.goto("/sign-up")
      await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible()
    })
    await evidence.step("Enter an email and a password", async () => {
      await page.getByLabel("Email").fill(account.email)
      await page.getByLabel("Password", { exact: true }).fill(account.password)
      await page.getByLabel("Confirm password").fill(account.password)
    })
    await evidence.step("Sign up: the account is created", async () => {
      const [response] = await Promise.all([
        page.waitForResponse((r) => r.url().endsWith(SIGN_UP_PATH)),
        page.getByRole("button", { name: "Sign up" }).click(),
      ])
      expect(response.ok()).toBe(true)
    })
    await evidence.step("The new account is real: its email and password sign in", async () => {
      expect(await canSignIn(playwright, baseURL, account)).toBe(true)
    })
  })

  test("AC2: After signing up, I am signed in and taken into the app", async ({
    page,
    evidence,
  }) => {
    const account = newAccount()

    await evidence.step("Sign up with a new email and password", async () => {
      await page.goto("/sign-up")
      await fillSignUp(page, account)
      await page.getByRole("button", { name: "Sign up" }).click()
    })
    await evidence.step("I land on the home page, signed in as the new account", async () => {
      await expect(page).toHaveURL(/\/$/)
      await expect(page.getByRole("heading", { name: `Welcome, ${account.name}!` })).toBeVisible()
      await expect(page.getByRole("button", { name: /^Sign out/ })).toBeVisible()
    })
    await evidence.step("Reloading keeps me signed in", async () => {
      await page.reload()
      await expect(page).toHaveURL(/\/$/)
      await expect(page.getByRole("button", { name: /^Sign out/ })).toBeVisible()
    })
  })

  test("AC3: If the email is already used or the details are invalid, I see a clear message and no account is created", async ({
    page,
    playwright,
    baseURL,
    evidence,
  }) => {
    const signUpCalls: string[] = []
    page.on("request", (r) => {
      if (r.url().endsWith(SIGN_UP_PATH)) signUpCalls.push(r.url())
    })

    await evidence.step("Invalid details: a bad email, a short password and a mismatch", async () => {
      await page.goto("/sign-up")
      await page.getByLabel("Email").fill("not-an-email")
      await page.getByLabel("Password", { exact: true }).fill("short")
      await page.getByLabel("Confirm password").fill("different")
      await page.getByRole("button", { name: "Sign up" }).click()
    })
    await evidence.step("Each problem gets a clear message, and nothing is sent", async () => {
      await expect(page.getByText("Enter a valid email")).toBeVisible()
      await expect(page.getByText("Password must be at least 8 characters")).toBeVisible()
      await expect(page.getByText("Passwords do not match")).toBeVisible()
      await expect(page).toHaveURL(/\/sign-up$/)
      expect(signUpCalls).toHaveLength(0)
    })

    const existing = newAccount()
    await evidence.step("Someone already has an account with this email", async () => {
      const api = await playwright.request.newContext({ baseURL })
      const res = await api.post(SIGN_UP_PATH, { data: existing })
      expect(res.ok()).toBe(true)
      await api.dispose()
    })

    const attempt = { ...newAccount(), email: existing.email }
    await evidence.step("Sign up with that already-used email", async () => {
      await fillSignUp(page, attempt)
      const [response] = await Promise.all([
        page.waitForResponse((r) => r.url().endsWith(SIGN_UP_PATH)),
        page.getByRole("button", { name: "Sign up" }).click(),
      ])
      expect(response.ok()).toBe(false)
    })
    await evidence.step("A clear message says the email is taken, and I stay signed out", async () => {
      await expect(page.getByRole("alert")).toHaveText(
        "An account with this email already exists. Try signing in instead."
      )
      await expect(page).toHaveURL(/\/sign-up$/)
      await page.goto("/")
      await expect(page).toHaveURL(/\/sign-in$/)
    })
    await evidence.step("No account was created: the new password doesn't sign in", async () => {
      expect(await canSignIn(playwright, baseURL, attempt)).toBe(false)
      expect(await canSignIn(playwright, baseURL, existing)).toBe(true)
    })
  })
})
