import { Accessibility, Ticket, Video, Search, Scissors, Eraser } from 'lucide-react'
import type { Feature } from '../types'

/**
 * Single source of truth for the feature tabs. Holds navigation metadata
 * only — route components are lazy-loaded in the router config so no feature
 * code (or future AI model) is pulled in until its route is visited.
 */
export const features: Feature[] = [
  {
    id: 'background-remover',
    path: '/background-remover',
    label: 'Background Remover',
    title: 'AI Background Remover',
    description: 'Remove an image background locally and download a transparent PNG.',
    icon: Scissors,
  },
  {
    id: 'object-remover',
    path: '/object-remover',
    label: 'Object Remover',
    title: 'AI Object Remover',
    description: 'Paint over unwanted objects in a photo and erase them locally.',
    icon: Eraser,
  },
  {
    id: 'ai-accessibility',
    path: '/ai-accessibility',
    label: 'Accessibility',
    title: 'AI Accessibility',
    description: 'Upload an image and generate accessible alt text.',
    icon: Accessibility,
  },
  {
    id: 'smart-ticket-creator',
    path: '/smart-ticket-creator',
    label: 'Ticket Creator',
    title: 'Smart Ticket Creator',
    description: 'Convert unstructured natural language into a structured issue ticket.',
    icon: Ticket,
  },
  {
    id: 'semantic-search',
    path: '/semantic-search',
    label: 'Semantic Search',
    title: 'Semantic Search',
    description: 'Search through local documents using semantic similarity.',
    icon: Search,
  },
  {
    id: 'pause-and-ask',
    path: '/pause-and-ask',
    label: 'Pause & Ask',
    title: 'Pause & Ask',
    description: 'Analyze a live camera feed, pause on a frame, and ask about its content.',
    icon: Video,
  },
]
