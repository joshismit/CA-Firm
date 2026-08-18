// white-label module — public entry point (PRD §4.3). Only the page is consumed by app-level
// routing; everything else (api/hooks/schemas/components) is this module's own internals.
export { WhiteLabelSettingsPage } from './pages'
export type { PublicBranding } from './types'
export { usePublicBrandingQuery } from './hooks'
