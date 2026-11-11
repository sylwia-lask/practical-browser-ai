import type { LucideIcon } from 'lucide-react'

/** Unique identifier for each feature tab. */
export type FeatureId =
  | 'ai-accessibility'
  | 'smart-ticket-creator'
  | 'pause-and-ask'
  | 'semantic-search'
  | 'background-remover'
  | 'object-remover'

/** Browser technology a feature will eventually rely on. */
export type BrowserTech = 'Transformers.js' | 'WebGPU' | 'WebAssembly' | 'ONNX Runtime'

/**
 * Navigation metadata for a feature route. The route component itself is
 * lazy-loaded in the router config, so it is intentionally not referenced here.
 */
export interface Feature {
  /** Stable id used for keys. */
  id: FeatureId
  /** URL path for the feature (e.g. "/ai-accessibility"). */
  path: string
  /** Short label shown in the tab bar. */
  label: string
  /** Human-readable title. */
  title: string
  /** One-line description of what the feature does. */
  description: string
  /** Icon rendered in the tab. */
  icon: LucideIcon
}
