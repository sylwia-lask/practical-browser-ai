import { Cpu, Zap, Loader2, AlertTriangle } from 'lucide-react'
import type { ModelFileProgress, InferenceDevice, WebGpuSupport } from '../types'
import type { ObjectRemoverStatus } from '../useObjectRemover'

interface ModelStatusProps {
  status: ObjectRemoverStatus
  support: WebGpuSupport
  device: InferenceDevice | null
  progress: ModelFileProgress[]
  /** Hugging Face model id, shown so users know exactly what's running. */
  modelId: string
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return ''
  const mb = bytes / (1024 * 1024)
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`
}

/** Human-readable label for the current phase. */
function phaseLabel(status: ObjectRemoverStatus): string | null {
  switch (status) {
    case 'loading-model':
      return 'Downloading model (one-time, then cached by the browser)…'
    case 'inpainting':
      return 'Filling the selected area on-device…'
    default:
      return null
  }
}

/**
 * Shows the inference backend (WebGPU vs WASM) and, while the model is
 * downloading, a per-file progress breakdown. This makes the one-time model
 * download visible instead of looking like a hang.
 */
export function ModelStatus({ status, support, device, progress, modelId }: ModelStatusProps) {
  const activeFiles = progress.filter((p) => (p.progress ?? 0) < 100)
  const loading = status === 'loading-model'
  const working = status === 'inpainting'
  const label = phaseLabel(status)

  return (
    <div className="space-y-3 rounded-lg border border-white/10 bg-white/[0.02] p-4">
      <p className="text-xs text-gray-400">
        Model:{' '}
        <a
          href={`https://huggingface.co/${modelId}`}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-gray-200 underline decoration-white/20 underline-offset-2 transition-colors hover:text-indigo-300 hover:decoration-indigo-300/60"
        >
          {modelId}
        </a>
      </p>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {device === 'webgpu' || (support.checked && support.webgpu && !device) ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-0.5 font-medium text-emerald-300">
            <Zap className="size-3.5" aria-hidden="true" />
            WebGPU acceleration
          </span>
        ) : device === 'wasm' ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-500/10 px-2.5 py-0.5 font-medium text-amber-300">
            <Cpu className="size-3.5" aria-hidden="true" />
            WebAssembly (CPU) fallback
          </span>
        ) : support.checked && !support.webgpu ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-500/10 px-2.5 py-0.5 font-medium text-amber-300">
            <AlertTriangle className="size-3.5" aria-hidden="true" />
            WebGPU unavailable — will use CPU (slower)
          </span>
        ) : (
          <span className="text-gray-500">Checking hardware acceleration…</span>
        )}
      </div>

      {(loading || working) && label && (
        <div className="space-y-2" role="status" aria-live="polite">
          <p className="flex items-center gap-2 text-sm text-gray-300">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            {label}
          </p>
          {loading &&
            (activeFiles.length > 0 ? (
              <ul className="space-y-1.5">
                {activeFiles.map((f) => (
                  <li key={f.file} className="space-y-1">
                    <div className="flex justify-between gap-2 text-xs text-gray-500">
                      <span className="truncate">{f.file}</span>
                      <span className="shrink-0 tabular-nums">
                        {f.progress != null ? `${Math.round(f.progress)}%` : ''}
                        {formatBytes(f.total) ? ` · ${formatBytes(f.total)}` : ''}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-indigo-400 transition-[width]"
                        style={{ width: `${Math.min(100, Math.round(f.progress ?? 0))}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-gray-500">Preparing files…</p>
            ))}
        </div>
      )}
    </div>
  )
}
