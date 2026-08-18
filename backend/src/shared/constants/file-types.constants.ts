/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Supported Document File Types — Single Source of Truth (PRD §7.5)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * PURPOSE:
 *   The one place that defines which file types the Documents module accepts.
 *   Every layer that needs to validate an upload — the `multer` fileFilter in
 *   `modules/documents/routes/document.routes.ts`, `DocumentService`'s own
 *   defense-in-depth check, Swagger docs, and the frontend's dropzone/Zod
 *   schema — reads from this list (or its frontend mirror,
 *   `frontend/src/modules/documents/constants/index.ts`). Never hardcode an
 *   extension or MIME type anywhere else.
 *
 * DESIGN:
 *   Each entry pairs an extension with the MIME type(s) a browser/OS
 *   legitimately sends for it, and the magic-byte signature(s) the file's
 *   actual content must start with. The signature is what makes "reject an
 *   executable renamed to .pdf" possible — extension and declared MIME type
 *   are both attacker-controlled request metadata; the file's own leading
 *   bytes are not.
 *
 * USAGE:
 *   import { SUPPORTED_DOCUMENT_TYPES } from '@shared/constants';
 *   import { FileValidation } from '@shared/utils';
 *   FileValidation.validate(file.originalname, file.mimetype, file.buffer);
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface SupportedDocumentType {
  /** Lowercase extension, without the leading dot. */
  extension: string;
  /** Human-readable label — used in Swagger descriptions and UI hints. */
  label: string;
  /** Every MIME type accepted for this extension. Extension AND MIME must both match. */
  mimeTypes: readonly string[];
  /** Uppercase hex magic-byte prefixes the file's content must start with. */
  signatures: readonly string[];
}

// PRD §7.5 — uploads are restricted to PDF, JPG/JPEG, and PNG only.
export const SUPPORTED_DOCUMENT_TYPES: readonly SupportedDocumentType[] = [
  { extension: 'pdf', label: 'PDF', mimeTypes: ['application/pdf'], signatures: ['25504446'] },
  { extension: 'jpg', label: 'JPG', mimeTypes: ['image/jpeg'], signatures: ['FFD8FF'] },
  { extension: 'jpeg', label: 'JPEG', mimeTypes: ['image/jpeg'], signatures: ['FFD8FF'] },
  { extension: 'png', label: 'PNG', mimeTypes: ['image/png'], signatures: ['89504E47'] },
] as const;

export const SUPPORTED_DOCUMENT_EXTENSIONS: readonly string[] = SUPPORTED_DOCUMENT_TYPES.map((t) => t.extension);

export const SUPPORTED_DOCUMENT_MIME_TYPES: readonly string[] = [
  ...new Set(SUPPORTED_DOCUMENT_TYPES.flatMap((t) => t.mimeTypes)),
];

/**
 * Explicitly rejected regardless of MIME type or content — checked before the
 * whitelist so a blocked extension always fails with the same clear reason.
 */
export const BLOCKED_EXECUTABLE_EXTENSIONS: readonly string[] = [
  'exe',
  'dll',
  'bat',
  'cmd',
  'sh',
  'js',
  'ts',
  'php',
  'py',
  'jar',
  'apk',
  'ipa',
] as const;
