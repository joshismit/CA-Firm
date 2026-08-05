import { FileValidation } from '@shared/utils';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * FileValidation — Unit Tests (PRD §7.5 — Supported File Types)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises the shared extension/MIME/magic-byte validator directly — the
 * same function both `modules/documents/routes/document.routes.ts`'s
 * `multer` `fileFilter` and `DocumentService.validateFile()` call. Higher-
 * level "does uploading actually get rejected" coverage lives in
 * `tests/unit/modules/documents/document.service.spec.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const PDF_BYTES = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // "%PDF-1.4"
const ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00]);
const OLE2 = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x00, 0x00, 0x00, 0x00]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00, 0x00, 0x00]);
const EXE = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]); // "MZ" — real PE header

describe('FileValidation', () => {
  describe('getExtension', () => {
    it('lowercases and strips the leading dot', () => {
      expect(FileValidation.getExtension('Report.PDF')).toBe('pdf');
    });

    it('takes the last extension when a filename has multiple dots', () => {
      expect(FileValidation.getExtension('archive.tar.gz')).toBe('gz');
    });

    it('returns an empty string for a filename with no extension', () => {
      expect(FileValidation.getExtension('README')).toBe('');
    });
  });

  describe('validate — allowed types (PRD §7.5 requirement 11)', () => {
    it.each([
      ['report.pdf', 'application/pdf', PDF_BYTES],
      ['ledger.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ZIP],
      ['ledger.xls', 'application/vnd.ms-excel', OLE2],
      ['agreement.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ZIP],
      ['agreement.doc', 'application/msword', OLE2],
      ['photo.jpg', 'image/jpeg', JPEG],
      ['image.jpeg', 'image/jpeg', JPEG],
      ['scan.png', 'image/png', PNG],
      ['bundle.zip', 'application/zip', ZIP],
    ])('accepts %s declared as %s with matching content', (fileName, mimetype, buffer) => {
      expect(FileValidation.validate(fileName as string, mimetype as string, buffer as Buffer)).toEqual({ valid: true });
    });

    it('accepts a zip declared with the common Windows alias application/x-zip-compressed', () => {
      expect(FileValidation.validate('bundle.zip', 'application/x-zip-compressed', ZIP)).toEqual({ valid: true });
    });

    it('accepts without a buffer (multer fileFilter stage — body not read yet)', () => {
      expect(FileValidation.validate('report.pdf', 'application/pdf')).toEqual({ valid: true });
    });
  });

  describe('validate — rejected: blocked executable/script extensions (PRD §7.5 requirement 4)', () => {
    it.each(['exe', 'dll', 'bat', 'cmd', 'sh', 'js', 'ts', 'php', 'py', 'jar', 'apk', 'ipa'])(
      'rejects .%s regardless of declared MIME type',
      (extension) => {
        const result = FileValidation.validate(`payload.${extension}`, 'application/octet-stream');
        expect(result.valid).toBe(false);
        expect(result.reason).toMatch(/not permitted/i);
      },
    );

    it('rejects a blocked extension even when the MIME type looks legitimate', () => {
      const result = FileValidation.validate('script.js', 'application/pdf');
      expect(result.valid).toBe(false);
    });
  });

  describe('validate — rejected: unsupported extension', () => {
    it('rejects an extension that is neither whitelisted nor blocklisted', () => {
      const result = FileValidation.validate('notes.txt', 'text/plain');
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/unsupported file extension/i);
    });

    it('rejects a filename with no extension at all', () => {
      const result = FileValidation.validate('README', 'text/plain');
      expect(result.valid).toBe(false);
    });
  });

  describe('validate — rejected: extension/MIME mismatch (PRD §7.5 requirements 2-4)', () => {
    it('rejects fake.pdf sent with an executable MIME type', () => {
      const result = FileValidation.validate('fake.pdf', 'application/x-msdownload');
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/does not match its content type/i);
    });

    it('rejects photo.jpg sent as application/octet-stream', () => {
      const result = FileValidation.validate('photo.jpg', 'application/octet-stream');
      expect(result.valid).toBe(false);
    });

    it('rejects a .docx sent with the .xlsx MIME type (cross-family mismatch)', () => {
      const result = FileValidation.validate(
        'report.docx',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      expect(result.valid).toBe(false);
    });
  });

  describe('validate — rejected: content does not match declared type (renamed executable)', () => {
    it('rejects a real Windows executable renamed to report.pdf with a spoofed application/pdf MIME type', () => {
      const result = FileValidation.validate('report.pdf', 'application/pdf', EXE);
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/does not match its declared type/i);
    });

    it('rejects a plain-text file renamed to image.png with a spoofed image/png MIME type', () => {
      const result = FileValidation.validate('image.png', 'image/png', Buffer.from('not actually a png'));
      expect(result.valid).toBe(false);
    });

    it('rejects an empty buffer even when extension/MIME match — nothing to confirm content against', () => {
      const result = FileValidation.validate('report.pdf', 'application/pdf', Buffer.alloc(0));
      expect(result.valid).toBe(false);
    });
  });
});
