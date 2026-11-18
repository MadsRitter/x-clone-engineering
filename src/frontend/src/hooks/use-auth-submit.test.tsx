import { act, renderHook } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const navigate = vi.fn()
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }))

import { useAuthSubmit } from "@/hooks/use-auth-submit"

function setup() {
  const queryClient = new QueryClient()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return renderHook(() => useAuthSubmit(), { wrapper })
}

describe("useAuthSubmit", () => {
  beforeEach(() => navigate.mockReset())

  it("goes into the app when the auth call succeeds", async () => {
    const { result } = setup()
    await act(() => result.current.submit(async () => ({ error: null })))
    expect(result.current.formError).toBeNull()
    expect(navigate).toHaveBeenCalledWith({ to: "/" })
  })

  it("shows the mapped message and stays put when the auth call fails", async () => {
    const { result } = setup()
    await act(() =>
      result.current.submit(async () => ({
        error: { code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" },
      }))
    )
    expect(result.current.formError).toMatch(/already exists/)
    expect(navigate).not.toHaveBeenCalled()
  })

  it("shows a clear message when the request itself throws", async () => {
    const { result } = setup()
    await act(() =>
      result.current.submit(async () => {
        throw new TypeError("Failed to fetch")
      })
    )
    expect(result.current.formError).toBe(
      "We couldn't reach the server. Check your connection and try again."
    )
    expect(navigate).not.toHaveBeenCalled()
  })
})
