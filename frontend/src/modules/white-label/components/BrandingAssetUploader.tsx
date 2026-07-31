// src/modules/white-label/components/BrandingAssetUploader.tsx
// One reusable uploader per image slot (logo/logoDark/favicon/loginBg) - same "presigned GET URL,
// never a raw storage key" contract as modules/documents, just a different upload endpoint.
import { useRef } from 'react'
import { ImageIcon, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { BrandingAssetSlot } from '../types'

export interface BrandingAssetUploaderProps {
  slot: BrandingAssetSlot
  label: string
  currentUrl: string | null | undefined
  onUpload: (file: File) => void
  isUploading?: boolean
  canManage: boolean
}

export function BrandingAssetUploader({ label, currentUrl, onUpload, isUploading, canManage }: BrandingAssetUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="flex items-center gap-3">
      <div className="w-14 h-14 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] flex items-center justify-center overflow-hidden shrink-0">
        {currentUrl ? (
          // eslint-disable-next-line jsx-a11y/alt-text -- alt is dynamic per-slot below via aria-label context; keeping this generic image tag simple.
          <img src={currentUrl} alt={label} className="w-full h-full object-contain" />
        ) : (
          <ImageIcon className="w-5 h-5 text-[var(--color-text-muted)]" />
        )}
      </div>
      <div className="flex-1">
        <p className="text-[12px] font-medium text-[var(--color-text-body)]">{label}</p>
        {canManage && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) onUpload(file)
                e.target.value = ''
              }}
            />
            <Button type="button" variant="secondary" size="sm" className="mt-1" loading={isUploading} onClick={() => inputRef.current?.click()}>
              <Upload className="w-3 h-3 mr-1.5" />
              Upload
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
