import { useEffect } from 'react'

const APP = 'Lesson Notes'

/** Sets the browser tab title (and what screen readers announce on navigation) for the current page. */
export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · ${APP}` : APP
  }, [title])
}
