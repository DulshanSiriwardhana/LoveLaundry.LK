/**
 * `ErrorState` lives in `empty-state.tsx` — it is the same presentation
 * surface with a different tone, and splitting it across two files invited
 * the two definitions to drift. This module re-exports it so the existing
 * `components/ui/error-state` import path keeps working.
 */
export { ErrorState } from './empty-state'
