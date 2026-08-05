import {
  SUPPORTED_DOCUMENT_TYPES,
  BLOCKED_EXECUTABLE_EXTENSIONS,
  SupportedDocumentType,
} from '../constants/file-types.constants';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * File Validation (PRD §7.5 — Supported File Types)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * PURPOSE:
 *   The one place that decides whether an uploaded file's extension, declared
 *   MIME type, and (when available) actual content agree with each other and
 *   with `SUPPORTED_DOCUMENT_TYPES`. Reused by both the `multer` fileFilter
 *   (extension + MIME only — the file hasn't been read into memory yet at
 *   that point) and `DocumentService.validateFile()` (full check, including
 *   the magic-byte signature, once `file.buffer` exists).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface FileValidationResult {
  valid: boolean;
  /** Present only when `valid` is false — a client-safe rejection reason. */
  reason?: string;
}

function getExtension(filename: string): string {
  const match = /\.([a-zA-Z0-9]+)$/.exec(filename);
  return match ? match[1].toLowerCase() : '';
}

function findSupportedType(filename: string): SupportedDocumentType | undefined {
  const extension = getExtension(filename);
  return SUPPORTED_DOCUMENT_TYPES.find((type) => type.extension === extension);
}

/** True when `buffer`'s leading bytes match one of `signatures` (case-insensitive hex prefix). */
function matchesSignature(buffer: Buffer, signatures: readonly string[]): boolean {
  if (buffer.length === 0) {
    return false;
  }
  const head = buffer.subarray(0, 8).toString('hex').toUpperCase();
  return signatures.some((signature) => head.startsWith(signature));
}

export const FileValidation = {
  getExtension,

  /**
   * Extension + declared-MIME-type check — safe to call before the file body
   * has been fully read (e.g. from a `multer` `fileFilter`, where only
   * `originalname`/`mimetype` headers are available yet).
   *
   * `buffer`, when passed, adds a magic-byte cross-check against the file's
   * actual content — this is what catches an executable renamed to a
   * supported extension with a spoofed Content-Type, since both the filename
   * and the declared MIME type are attacker-controlled request metadata but
   * the file's own leading bytes are not.
   */
  validate(filename: string, mimetype: string, buffer?: Buffer): FileValidationResult {
    const extension = getExtension(filename);

    if ((BLOCKED_EXECUTABLE_EXTENSIONS as readonly string[]).includes(extension)) {
      return { valid: false, reason: `Executable and script files are not permitted: .${extension}` };
    }

    const type = findSupportedType(filename);
    if (!type) {
      return {
        valid: false,
        reason: extension
          ? `Unsupported file extension: .${extension}`
          : 'File must have a supported extension.',
      };
    }

    if (!(type.mimeTypes as readonly string[]).includes(mimetype)) {
      return {
        valid: false,
        reason: `File extension ".${type.extension}" does not match its content type (${mimetype}).`,
      };
    }

    if (buffer && !matchesSignature(buffer, type.signatures)) {
      return {
        valid: false,
        reason: `File content does not match its declared type (.${type.extension}).`,
      };
    }

    return { valid: true };
  },
};
