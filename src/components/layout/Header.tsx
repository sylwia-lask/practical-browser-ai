import { Cpu, Sparkles } from 'lucide-react'
import { Badge } from '../ui/Badge'

/** App header: title, subtitle, and subtle local-inference tech references. */
export function Header() {
  return (
    <header className="border-b border-white/10 bg-white/[0.02]">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg border border-white/10 bg-indigo-500/10 text-indigo-300">
            <Sparkles className="size-5" aria-hidden="true" />
          </span>
          <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
            Practical Browser AI
          </h1>
        </div>
        <p className="mt-3 max-w-2xl text-sm text-gray-400 sm:text-base">
          6 practical AI features. No backend. No cloud. Just your browser.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge>
            <Cpu className="size-3" aria-hidden="true" />
            WebGPU
          </Badge>
          <Badge>WebAssembly</Badge>
          <Badge>Local inference</Badge>
        </div>
      </div>
    </header>
  )
}
