import { useEffect, useRef } from "react"

/**
 * Calls `onVisible` whenever the returned ref's element scrolls into view (within
 * `rootMargin`). While `enabled` is false nothing is observed.
 */
export function useOnVisible<T extends Element>(
  onVisible: () => void,
  { enabled = true, rootMargin = "0px" }: { enabled?: boolean; rootMargin?: string } = {}
) {
  const ref = useRef<T>(null)
  const callback = useRef(onVisible)

  useEffect(() => {
    callback.current = onVisible
  }, [onVisible])

  useEffect(() => {
    const el = ref.current
    if (!el || !enabled) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) callback.current()
      },
      { rootMargin }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [enabled, rootMargin])

  return ref
}
