import { useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { useQueryClient } from "@tanstack/react-query"

import { mapAuthErrorToMessage, NETWORK_ERROR_MESSAGE } from "@/lib/auth-errors"

type AuthResult = { error: { code?: string; message?: string } | null }

export function useAuthSubmit() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [formError, setFormError] = useState<string | null>(null)

  const submit = async (authCall: () => Promise<AuthResult>) => {
    setFormError(null)

    let error: AuthResult["error"]
    try {
      ;({ error } = await authCall())
    } catch {
      // A failed request (offline, server down) must not leave the form
      // silently stuck — say what happened and let the person retry.
      setFormError(NETWORK_ERROR_MESSAGE)
      return
    }

    if (error) {
      setFormError(mapAuthErrorToMessage(error))
      return
    }

    await queryClient.invalidateQueries({
      queryKey: ["session"],
      refetchType: "all",
    })
    navigate({ to: "/" })
  }

  return { formError, submit }
}
