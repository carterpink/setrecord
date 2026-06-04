/**
 * moodIntent.ts — pure detector mapping a vibe/energy request to a mood key.
 * Compute lives in electron/algorithms/memory/mood.ts.
 */

export type MoodKey =
  | 'euphoric' // 088
  | 'melancholic' // 089
  | 'hypnotic' // 090
  | 'late_night' // 091 (6am)
  | 'aggressive' // 092
  | 'emotional' // 093
  | 'tension' // 094
  | 'ambient_intro' // 095
  | 'uplifting' // 096
  | 'underwater' // 097
  | 'club_ready' // 098
  | 'reading_crowd' // 099
  | 'cinematic' // 100
  | 'chill' // 101

export function detectMood(raw: string): MoodKey | null {
  const q = raw.toLowerCase().trim()

  if (/\baggressive|brutal|hardest|most (hard|heavy)|main stage drop|festival.*drop/.test(q))
    return 'aggressive'
  if (/\bclub.?ready\b/.test(q)) return 'club_ready'
  if (/\breading the crowd|read the crowd|versatile/.test(q)) return 'reading_crowd'
  if (/\bunderwater|submerged|being under water|deep and dreamy/.test(q)) return 'underwater'
  if (/\bambient intro|atmospheric intro|intro track|use as (an )?intro/.test(q))
    return 'ambient_intro'
  if (/\bhypnotic|repetitive|trippy|mesmeri[sz]ing/.test(q)) return 'hypnotic'
  if (/\b6 ?am|sunrise crowd|early morning|late[- ]night|peak of the night/.test(q))
    return 'late_night'
  if (/\bcinematic|filmic|orchestral|epic|movie/.test(q)) return 'cinematic'
  if (/\b(most )?emotional\b/.test(q)) return 'emotional'
  if (/\bmelancholic|melancholy|sad\b|wistful|moody and slow/.test(q)) return 'melancholic'
  if (/\bbuild tension|builds? tension|\btension\b/.test(q)) return 'tension'
  if (/\buplifting|feel.?good|sunny|daytime (festival|crowd)/.test(q)) return 'uplifting'
  if (
    /\beuphoric|euphoria|for the peak|peak[- ]?time melodic|hands in the air|slaps?\b|bangers?\b|that slaps|hard.?hitting/.test(
      q
    )
  )
    return 'euphoric'
  if (/\bchill|chilled|mellow|beach|laid.?back|relaxed/.test(q)) return 'chill'

  return null
}
