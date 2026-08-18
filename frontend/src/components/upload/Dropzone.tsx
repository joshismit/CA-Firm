// src/components/upload/Dropzone.tsx
// Generic drag-and-drop + click-to-browse file picker. Emits the raw FileList/File[] the caller
// asked for (multiple or single) - no upload logic here, that's the caller's job (see
// modules/documents' upload queue for the real usage).
import { useRef, useState, type DragEvent } from 'react'
import { UploadCloud } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface DropzoneProps {
  onFilesSelected: (files: File[]) => void
  accept?: string
  multiple?: boolean
  disabled?: boolean
  label?: string
  hint?: string
  className?: string
}

export function Dropzone({
  onFilesSelected,
  accept,
  multiple = true,
  disabled = false,
  label = 'Drag & drop files here, or click to browse',
  hint,
  className,
}: DropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    onFilesSelected(Array.from(fileList))
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragOver(false)
    if (disabled) return
    handleFiles(e.dataTransfer.files)
  }

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          inputRef.current?.click()
        }
      }}
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setIsDragOver(true)
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-[var(--radius-lg)] border-2 border-dashed p-8 text-center transition-colors cursor-pointer',
        isDragOver ? 'border-[var(--color-primary-400)] bg-[var(--color-primary-50)]' : 'border-[var(--color-border)]',
        disabled && 'opacity-60 cursor-not-allowed',
        className
      )}
    >
      <UploadCloud className="w-7 h-7 text-[var(--color-text-muted)]" aria-hidden="true" />
      <p className="text-[13px] font-medium text-[var(--color-text-body)]">{label}</p>
      {hint && <p className="text-[11px] text-[var(--color-text-muted)]">{hint}</p>}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        className="sr-only"
        onChange={(e) => {
          handleFiles(e.target.files)
          e.target.value = ''
        }}
        aria-label={label}
      />
    </div>
  )
}
