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
 *   bytes are not. `.doc`/`.xls` share the legacy OLE2 compound-file
 *   signature, and `.docx`/`.xlsx`/`.zip` share the Zip signature (they *are*
 *   Zip containers) — the signature check only confirms the file is
 *   genuinely some member of that format family, never used to distinguish
 *   between them (that's the extension+MIME pair's job).
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

const ZIP_SIGNATURES = ['504B0304', '504B0506', '504B0708'] as const;
const OLE2_SIGNATURE = ['D0CF11E0A1B11AE1'] as const;

export const SUPPORTED_DOCUMENT_TYPES: readonly SupportedDocumentType[] = [
  { extension: 'pdf', label: 'PDF', mimeTypes: ['application/pdf'], signatures: ['25504446'] },
  { extension: 'doc', label: 'Word (.doc)', mimeTypes: ['application/msword'], signatures: OLE2_SIGNATURE },
  {
    extension: 'docx',
    label: 'Word (.docx)',
    mimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    signatures: ZIP_SIGNATURES,
  },
  { extension: 'xls', label: 'Excel (.xls)', mimeTypes: ['application/vnd.ms-excel'], signatures: OLE2_SIGNATURE },
  {
    extension: 'xlsx',
    label: 'Excel (.xlsx)',
    mimeTypes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    signatures: ZIP_SIGNATURES,
  },
  { extension: 'jpg', label: 'JPG', mimeTypes: ['image/jpeg'], signatures: ['FFD8FF'] },
  { extension: 'jpeg', label: 'JPEG', mimeTypes: ['image/jpeg'], signatures: ['FFD8FF'] },
  { extension: 'png', label: 'PNG', mimeTypes: ['image/png'], signatures: ['89504E47'] },
  {
    extension: 'zip',
    label: 'ZIP',
    // `application/x-zip-compressed` is the de-facto alias Windows/older browsers send for .zip —
    // accepted alongside the canonical `application/zip` so a genuinely-zip upload isn't rejected
    // on a client MIME-sniffing quirk. Matches the frontend's existing SUPPORTED_MIME_TYPES list.
    mimeTypes: ['application/zip', 'application/x-zip-compressed'],
    signatures: ZIP_SIGNATURES,
  },
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
