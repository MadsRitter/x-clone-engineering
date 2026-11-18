type DisplayNameUser = { name?: string | null; email: string }

export function getDisplayName(user: DisplayNameUser): string {
  return user.name?.trim() || user.email.split("@")[0]
}

/** "@handle", whether or not the API already prefixed it. */
export function formatHandle(handle: string): string {
  return `@${handle.replace(/^@+/, "")}`
}
