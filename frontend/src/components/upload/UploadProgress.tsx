// src/components/upload/UploadProgress.tsx
// Per-file progress row, built on the existing ui/progress.tsx Progress bar - not a new progress
// primitive. Status drives the bar's tone (queued=default/info, uploading=primary, success=success,
// error=danger).
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import type { UploadStatus } from './FileList'

export interface UploadProgressProps {
  status: UploadStatus
  progress: number
  errorMessage?: string
  className?: string
}

const STATUS_LABEL: Record<UploadStatus, string> = {
  queued: 'Queued',
  uploading: 'Uploading…',
  success: 'Uploaded',
  error: 'Failed',
}

export function UploadProgress({ status, progress, errorMessage, className }: UploadProgressProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {status === 'success' ? (
        <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-success)] shrink-0" aria-hidden="true" />
      ) : status === 'error' ? (
        <AlertCircle className="w-3.5 h-3.5 text-[var(--color-danger)] shrink-0" aria-hidden="true" />
      ) : status === 'uploading' ? (
        <Loader2 className="w-3.5 h-3.5 text-[var(--color-primary-600)] shrink-0 animate-spin" aria-hidden="true" />
      ) : null}

      {status === 'error' ? (
        <span className="text-[11px] text-[var(--color-danger)] truncate">{errorMessage ?? STATUS_LABEL.error}</span>
      ) : (
        <Progress
          value={status === 'queued' ? 0 : progress}
          tone={status === 'success' ? 'success' : 'primary'}
          height={4}
          className="flex-1"
          aria-label={STATUS_LABEL[status]}
        />
      )}
    </div>
  )
}
