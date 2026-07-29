// src/components/upload/FileList.tsx
// Generic upload-queue list - one row per queued/uploading/uploaded/failed file. The queue itself
// (adding files, running uploads sequentially, tracking progress) lives in the caller (see
// modules/documents/pages/DocumentUploadPage.tsx); this component only renders the given items.
import { X } from 'lucide-react'
import { IconButton } from '@/components/ui/icon-button'
import { formatFileSize } from '@/lib/utils'
import { FilePreview } from './FilePreview'
import { UploadProgress } from './UploadProgress'

export type UploadStatus = 'queued' | 'uploading' | 'success' | 'error'

export interface UploadQueueItem {
  id: string
  file: File
  status: UploadStatus
  progress: number
  error?: string
}

export interface FileListProps {
  items: UploadQueueItem[]
  onRemove?: (id: string) => void
}

export function FileList({ items, onRemove }: FileListProps) {
  if (items.length === 0) return null

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-card)] p-2.5"
        >
          <FilePreview file={item.file} size={32} />
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-medium text-[var(--color-text-body)] truncate">{item.file.name}</p>
            <p className="text-[11px] text-[var(--color-text-muted)]">{formatFileSize(item.file.size)}</p>
            <UploadProgress status={item.status} progress={item.progress} errorMessage={item.error} className="mt-1" />
          </div>
          {onRemove && item.status !== 'uploading' && (
            <IconButton
              label={`Remove ${item.file.name}`}
              size="sm"
              variant="ghost"
              onClick={() => onRemove(item.id)}
            >
              <X className="w-3.5 h-3.5" />
            </IconButton>
          )}
        </li>
      ))}
    </ul>
  )
}
