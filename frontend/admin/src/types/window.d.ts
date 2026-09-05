import { type Edge, type Node, type SetViewport, type Viewport } from 'reactflow'

interface AppStateType {
  flowState: {
    edges: Edge[]
    nodes: Node[]
    setViewport: SetViewport
    viewport: Viewport
  }
}

interface WpMediaFrame {
  on: (event: string, callback: () => void) => void
  open: () => void
  state: () => {
    get: (key: string) => {
      first: () => {
        toJSON: () => WpMediaAttachment
      }
    }
  }
}

interface WpMediaAttachment {
  [key: string]: unknown
  id: number
  url: string
}

interface WpMediaOptions {
  button?: {
    text?: string
  }
  library?: {
    type?: string
  }
  multiple?: boolean
  title?: string
}

type WpMedia = (options?: WpMediaOptions) => WpMediaFrame

interface Wp {
  media?: WpMedia
}

declare global {
  interface Window {
    appState: AppStateType
    wp?: Wp
  }
}

export {}
