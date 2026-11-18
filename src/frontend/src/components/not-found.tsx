import { useQuery } from "@tanstack/react-query"
import { Link, Navigate } from "@tanstack/react-router"

import { Button } from "@/components/ui/button"
import { sessionQueryOptions } from "@/lib/session"

// A path the app doesn't have. Signed out, it is just another page behind sign-in (XC-7):
// send the visitor to sign in rather than confirm what does or doesn't exist.
export function NotFound() {
  const { data: session, isPending } = useQuery(sessionQueryOptions)

  if (isPending) return null
  if (!session) return <Navigate to="/sign-in" replace />

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-4 text-center">
      <h1 className="text-xl font-bold text-foreground">Page not found</h1>
      <p className="text-sm text-muted-foreground">This page doesn't exist.</p>
      <Button asChild variant="outline">
        <Link to="/">Back to home</Link>
      </Button>
    </div>
  )
}
