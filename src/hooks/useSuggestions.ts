import { useState, useEffect, useCallback, useRef } from 'react'
import type { Suggestion } from '@/types'

export function useSuggestions(
  trackId: string | null,
  setId: string | null,
  count = 6,
  excludeIds: string[] = [],
  sourcePlaylistIds: string[] = [],
): { suggestions: Suggestion[]; isLoading: boolean; refresh: () => void } {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Always hold the latest excludeIds without making it an effect dependency
  const excludeRef = useRef(excludeIds)
  excludeRef.current = excludeIds
  const sourceRef = useRef(sourcePlaylistIds)
  sourceRef.current = sourcePlaylistIds
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
      const results = await window.setsense.getSuggestions(
        trackId,
        setId ?? '',
        count,
        excludeRef.current,
        sourceRef.current,
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
  }, [trackId, setId, count, sourceKey])

  const refresh = useCallback(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current)
    void fetchSuggestions()
  }, [fetchSuggestions])

  useEffect(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current)

    if (!trackId) {
      setSuggestions([])
      return
    }

    timerRef.current = setTimeout(() => {
      timerRef.current = null
      void fetchSuggestions()
    }, 200)

    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current)
    }
  }, [fetchSuggestions, trackId])

  return { suggestions, isLoading, refresh }
}
