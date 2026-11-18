type AuthErrorLike = { code?: string; message?: string } | null | undefined

const ALREADY_EXISTS =
  "An account with this email already exists. Try signing in instead."

const messagesByCode: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "Incorrect email or password.",
  USER_ALREADY_EXISTS: ALREADY_EXISTS,
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: ALREADY_EXISTS,
  INVALID_EMAIL: "Enter a valid email address.",
  PASSWORD_TOO_SHORT: "That password is too short. Use at least 8 characters.",
  PASSWORD_TOO_LONG: "That password is too long. Try a shorter one.",
}

export const NETWORK_ERROR_MESSAGE =
  "We couldn't reach the server. Check your connection and try again."

export function mapAuthErrorToMessage(error: AuthErrorLike): string {
  if (!error) return ""
  return (
    messagesByCode[error.code ?? ""] ??
    error.message ??
    "Something went wrong. Please try again."
  )
}
