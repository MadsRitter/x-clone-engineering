import { describe, expect, it } from "vitest"

import { formatHandle } from "@/lib/user"

describe("formatHandle", () => {
  it("keeps a handle the API already prefixed", () => {
    expect(formatHandle("@ada")).toBe("@ada")
  })

  it("adds the @ when it's missing", () => {
    expect(formatHandle("ada")).toBe("@ada")
  })
})
