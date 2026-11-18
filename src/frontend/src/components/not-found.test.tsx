import { render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"

vi.mock("@tanstack/react-router", () => ({
  Navigate: ({ to }: { to: string }) => <div data-testid="navigate">{to}</div>,
  Link: ({ to, children, ...rest }: { to: string; children: ReactNode }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}))
vi.mock("@/lib/auth-client", () => ({ getSession: vi.fn(() => new Promise(() => {})) }))

import { NotFound } from "@/components/not-found"
import { sessionQueryOptions } from "@/lib/session"

function renderWith(session?: unknown) {
  const queryClient = new QueryClient()
  if (session !== undefined) queryClient.setQueryData(sessionQueryOptions.queryKey, session as never)
  return render(
    <QueryClientProvider client={queryClient}>
      <NotFound />
    </QueryClientProvider>
  )
}

describe("NotFound", () => {
  it("shows nothing while it doesn't know yet who is signed in", () => {
    const { container } = renderWith()
    expect(container).toBeEmptyDOMElement()
  })

  it("sends a signed-out visitor to sign in", () => {
    renderWith(null)
    expect(screen.getByTestId("navigate")).toHaveTextContent("/sign-in")
    expect(screen.queryByText("Page not found")).not.toBeInTheDocument()
  })

  it("tells a signed-in person the page doesn't exist, with a way home", () => {
    renderWith({ user: { id: "u1", email: "a@example.test", name: "A" } })
    expect(screen.getByRole("heading", { name: "Page not found" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Back to home" })).toHaveAttribute("href", "/")
    expect(screen.queryByTestId("navigate")).not.toBeInTheDocument()
  })
})
