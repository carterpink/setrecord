import { useState, useEffect, useCallback, useRef } from 'react'
import type { Suggestion } from '@/types'

export function useSuggestions(
  trackId: string | null,
  setId: string | null,
  count = 6,
  excludeIds: string[] = [],
  sourcePlaylistIds: string[] = []
): { suggestions: Suggestion[]; isLoading: boolean; refresh: () => void } {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Always hold the latest excludeIds/sources without making them effect
  // dependencies. Synced in an effect (not during render) per react-hooks/refs.
  const excludeRef = useRef(excludeIds)
  const sourceRef = useRef(sourcePlaylistIds)
  useEffect(() => {
    excludeRef.current = excludeIds
    sourceRef.current = sourcePlaylistIds
  })
  // Stable key so changes in source selection retrigger fetching without
  // depending on array identity.
  const sourceKey = sourcePlaylistIds.join(',')

  const fetchSuggestions = useCallback(async () => {
    if (!trackId) {
      setSuggestions([])
      return
    }
    setIsLoading(true)
    try {
      const results = await window.setrecord.getSuggestions(
        trackId,
        setId ?? '',
        count,
        excludeRef.current,
        sourceRef.current
      )
      // Client-side safety filter: exclude any track that is currently in the set.
      // This is the final guard against the DB-save race condition — the renderer
      // always knows the ground truth of what's already been added.
      const excluded = new Set(excludeRef.current)
      setSuggestions(results.filter((s) => !excluded.has(s.track.id)))
    } catch {
      setSuggestions([])
    } finally {
      setIsLoading(false)
    }
    // sourceKey is intentional: it isn't read in the body (we use sourceRef) but
    // it must stay in deps so changing the source-playlist selection refetches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackId, setId, count, sourceKey])

  const refresh = useCallback(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current)
    void fetchSuggestions()
  }, [fetchSuggestions])

  useEffect(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current)

    if (!trackId) return

    timerRef.current = setTimeout(() => {
      timerRef.current = null
      void fetchSuggestions()
    }, 200)

    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current)
    }
  }, [fetchSuggestions, trackId])

  // Mask stale suggestions when there's no track, rather than clearing state in
  // the effect above (avoids react-hooks/set-state-in-effect).
  return { suggestions: trackId ? suggestions : [], isLoading, refresh }
}
