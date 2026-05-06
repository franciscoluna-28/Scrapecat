import * as React from "react"

const MOBILE_BREAKPOINT = 768

function getIsMobile() {
  return window.innerWidth < MOBILE_BREAKPOINT
}

function subscribe(callback: () => void) {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
  mql.addEventListener("change", callback)
  return () => mql.removeEventListener("change", callback)
}

export function useIsMobile() {
  const isMobile = React.useSyncExternalStore(
    subscribe,
    getIsMobile,
    () => undefined
  )
  return !!isMobile
}
