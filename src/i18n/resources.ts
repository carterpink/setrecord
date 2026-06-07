import type { Resource } from 'i18next'

import enCommon from '@/locales/en/common.json'
import enSettings from '@/locales/en/settings.json'
import enHome from '@/locales/en/home.json'
import enLayout from '@/locales/en/layout.json'
import enLibrary from '@/locales/en/library.json'
import enOnboarding from '@/locales/en/onboarding.json'
import enRecall from '@/locales/en/recall.json'
import enTimeline from '@/locales/en/timeline.json'
import enLive from '@/locales/en/live.json'
import enLearn from '@/locales/en/learn.json'
import enSuggestions from '@/locales/en/suggestions.json'
import enModals from '@/locales/en/modals.json'
import enShared from '@/locales/en/shared.json'

import esCommon from '@/locales/es/common.json'
import esSettings from '@/locales/es/settings.json'
import esHome from '@/locales/es/home.json'
import esLayout from '@/locales/es/layout.json'
import esLibrary from '@/locales/es/library.json'
import esOnboarding from '@/locales/es/onboarding.json'
import esRecall from '@/locales/es/recall.json'
import esTimeline from '@/locales/es/timeline.json'
import esLive from '@/locales/es/live.json'
import esLearn from '@/locales/es/learn.json'
import esSuggestions from '@/locales/es/suggestions.json'
import esModals from '@/locales/es/modals.json'
import esShared from '@/locales/es/shared.json'

import deCommon from '@/locales/de/common.json'
import deSettings from '@/locales/de/settings.json'
import deHome from '@/locales/de/home.json'
import deLayout from '@/locales/de/layout.json'
import deLibrary from '@/locales/de/library.json'
import deOnboarding from '@/locales/de/onboarding.json'
import deRecall from '@/locales/de/recall.json'
import deTimeline from '@/locales/de/timeline.json'
import deLive from '@/locales/de/live.json'
import deLearn from '@/locales/de/learn.json'
import deSuggestions from '@/locales/de/suggestions.json'
import deModals from '@/locales/de/modals.json'
import deShared from '@/locales/de/shared.json'

import frCommon from '@/locales/fr/common.json'
import frSettings from '@/locales/fr/settings.json'
import frHome from '@/locales/fr/home.json'
import frLayout from '@/locales/fr/layout.json'
import frLibrary from '@/locales/fr/library.json'
import frOnboarding from '@/locales/fr/onboarding.json'
import frRecall from '@/locales/fr/recall.json'
import frTimeline from '@/locales/fr/timeline.json'
import frLive from '@/locales/fr/live.json'
import frLearn from '@/locales/fr/learn.json'
import frSuggestions from '@/locales/fr/suggestions.json'
import frModals from '@/locales/fr/modals.json'
import frShared from '@/locales/fr/shared.json'

import ptBrCommon from '@/locales/pt-BR/common.json'
import ptBrSettings from '@/locales/pt-BR/settings.json'
import ptBrHome from '@/locales/pt-BR/home.json'
import ptBrLayout from '@/locales/pt-BR/layout.json'
import ptBrLibrary from '@/locales/pt-BR/library.json'
import ptBrOnboarding from '@/locales/pt-BR/onboarding.json'
import ptBrRecall from '@/locales/pt-BR/recall.json'
import ptBrTimeline from '@/locales/pt-BR/timeline.json'
import ptBrLive from '@/locales/pt-BR/live.json'
import ptBrLearn from '@/locales/pt-BR/learn.json'
import ptBrSuggestions from '@/locales/pt-BR/suggestions.json'
import ptBrModals from '@/locales/pt-BR/modals.json'
import ptBrShared from '@/locales/pt-BR/shared.json'

/** Namespaces loaded for every language. `common` is the i18next default. */
export const NAMESPACES = [
  'common',
  'settings',
  'home',
  'layout',
  'library',
  'onboarding',
  'recall',
  'timeline',
  'live',
  'learn',
  'suggestions',
  'modals',
  'shared'
] as const

export const DEFAULT_NAMESPACE = 'common'

/**
 * All translation bundles, keyed by language then namespace. Bundled at build
 * time (no async loading) so the very first paint is already localised. As more
 * screens are migrated, add their namespace files here.
 */
export const resources: Resource = {
  en: {
    common: enCommon,
    settings: enSettings,
    home: enHome,
    layout: enLayout,
    library: enLibrary,
    onboarding: enOnboarding,
    recall: enRecall,
    timeline: enTimeline,
    live: enLive,
    learn: enLearn,
    suggestions: enSuggestions,
    modals: enModals,
    shared: enShared
  },
  es: {
    common: esCommon,
    settings: esSettings,
    home: esHome,
    layout: esLayout,
    library: esLibrary,
    onboarding: esOnboarding,
    recall: esRecall,
    timeline: esTimeline,
    live: esLive,
    learn: esLearn,
    suggestions: esSuggestions,
    modals: esModals,
    shared: esShared
  },
  de: {
    common: deCommon,
    settings: deSettings,
    home: deHome,
    layout: deLayout,
    library: deLibrary,
    onboarding: deOnboarding,
    recall: deRecall,
    timeline: deTimeline,
    live: deLive,
    learn: deLearn,
    suggestions: deSuggestions,
    modals: deModals,
    shared: deShared
  },
  fr: {
    common: frCommon,
    settings: frSettings,
    home: frHome,
    layout: frLayout,
    library: frLibrary,
    onboarding: frOnboarding,
    recall: frRecall,
    timeline: frTimeline,
    live: frLive,
    learn: frLearn,
    suggestions: frSuggestions,
    modals: frModals,
    shared: frShared
  },
  'pt-BR': {
    common: ptBrCommon,
    settings: ptBrSettings,
    home: ptBrHome,
    layout: ptBrLayout,
    library: ptBrLibrary,
    onboarding: ptBrOnboarding,
    recall: ptBrRecall,
    timeline: ptBrTimeline,
    live: ptBrLive,
    learn: ptBrLearn,
    suggestions: ptBrSuggestions,
    modals: ptBrModals,
    shared: ptBrShared
  }
}
