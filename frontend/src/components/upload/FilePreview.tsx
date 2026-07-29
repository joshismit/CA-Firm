// src/components/upload/FilePreview.tsx
// Small thumbnail/icon for a file. Renders a real image thumbnail (via a local object URL - never
// uploaded anywhere) when given an image File, otherwise a generic file-type icon. Works for either
// a not-yet-uploaded local `File` or an already-uploaded document's `mimeType`/`fileName`.
import { useEffect, useState } from 'react'
import { FileText, FileImage, FileSpreadsheet, File as FileIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface FilePreviewProps {
  file?: File
  mimeType?: string
  fileName?: string
  size?: number
  className?: string
}

function iconFor(mimeType: string | undefined) {
  if (!mimeType) return FileIcon
  if (mimeType.startsWith('image/')) return FileImage
  if (mimeType.includes('sheet') || mimeType.includes('excel') || mimeType === 'text/csv') return FileSpreadsheet
  if (mimeType === 'application/pdf' || mimeType.includes('word') || mimeType === 'text/plain') return FileText
  return FileIcon
}

export function FilePreview({ file, mimeType, fileName, size = 36, className }: FilePreviewProps) {
  const resolvedMimeType = mimeType ?? file?.type
  const isImage = !!resolvedMimeType?.startsWith('image/')
  const [objectUrl, setObjectUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!isImage || !file) {
      setObjectUrl(null)
      return
    }
    const url = URL.createObjectURL(file)
    setObjectUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file, isImage])

  if (objectUrl) {
    return (
      <img
        src={objectUrl}
        alt={fileName ?? file?.name ?? 'File preview'}
        style={{ width: size, height: size }}
        className={cn('rounded-[var(--radius-sm)] object-cover shrink-0', className)}
      />
    )
  }

  const Icon = iconFor(resolvedMimeType)
  return (
    <div
      style={{ width: size, height: size }}
      className={cn('rounded-[var(--radius-sm)] bg-[var(--color-surface)] flex items-center justify-center shrink-0', className)}
    >
      <Icon className="w-4 h-4 text-[var(--color-text-muted)]" aria-hidden="true" />
    </div>
  )
}
