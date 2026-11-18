import { describe, expect, it } from "vitest"

import { mapAuthErrorToMessage } from "@/lib/auth-errors"

describe("mapAuthErrorToMessage", () => {
  it.each([
    "USER_ALREADY_EXISTS",
    "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
  ])("explains an already-used email (%s)", (code) => {
    expect(mapAuthErrorToMessage({ code, message: "User already exists." })).toBe(
      "An account with this email already exists. Try signing in instead."
    )
  })

  it("explains an invalid email", () => {
    expect(mapAuthErrorToMessage({ code: "INVALID_EMAIL" })).toBe(
      "Enter a valid email address."
    )
  })

  it("explains a password that is too short or too long", () => {
    expect(mapAuthErrorToMessage({ code: "PASSWORD_TOO_SHORT" })).toMatch(/too short/i)
    expect(mapAuthErrorToMessage({ code: "PASSWORD_TOO_LONG" })).toMatch(/too long/i)
  })

  it("falls back to the server's message for unknown codes", () => {
    expect(mapAuthErrorToMessage({ code: "SOMETHING_NEW", message: "Nope" })).toBe("Nope")
  })

  it("falls back to a generic message when there is nothing to show", () => {
    expect(mapAuthErrorToMessage({})).toBe("Something went wrong. Please try again.")
  })
})
