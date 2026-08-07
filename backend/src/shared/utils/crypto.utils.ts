import crypto from 'crypto';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Cryptographic Utilities
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * PURPOSE:
 *   Provides GENERIC cryptographic functions (random tokens, hashes, HMACs).
 *
 * RULES:
 *   - NO password hashing logic here (bcrypt/argon2 belongs in the Auth module).
 *   - All random generation must use cryptographically secure `crypto` methods.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const CryptoUtils = {
  /**
   * Generates a cryptographically secure random hexadecimal string.
   * Useful for API keys, invitation tokens, and password reset tokens.
   *
   * @param bytes - The number of random bytes to generate (defaults to 32)
   * @returns A hex string twice the length of the bytes requested (e.g. 32 bytes = 64 chars)
   */
  generateRandomToken(bytes = 32): string {
    return crypto.randomBytes(bytes).toString('hex');
  },

  /**
   * Generates a cryptographically secure numeric OTP code.
   *
   * @param length - The length of the OTP (defaults to 6)
   * @returns A string containing only numbers
   */
  generateNumericOTP(length = 6): string {
    if (length < 4 || length > 10) {
      throw new Error('OTP length must be between 4 and 10');
    }

    let otp = '';
    while (otp.length < length) {
      // Generate a random byte and mod it by 10 to get a digit 0-9
      const buffer = crypto.randomBytes(1);
      const digit = buffer[0] % 10;
      otp += digit.toString();
    }
    return otp;
  },

  /**
   * Creates a SHA-256 hash of a given string.
   * Useful for hashing tokens in the database to prevent plain-text leaks,
   * or generating stable unique identifiers from deterministic inputs.
   *
   * @param data - The string to hash
   * @returns The hex representation of the SHA-256 hash
   */
  sha256(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  },

  /**
   * Computes an HMAC-SHA256 hex digest — used to verify Razorpay's payment/webhook
   * signatures (`modules/billing`), which are signed the same way.
   */
  hmacSha256Hex(data: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
  },

  /**
   * Constant-time comparison of two hex digests of potentially different lengths —
   * `crypto.timingSafeEqual` throws if buffer lengths differ, so length is checked first
   * (a length mismatch alone leaking via timing is not a meaningful attack surface here).
   */
  timingSafeEqualHex(a: string, b: string): boolean {
    const bufA = Buffer.from(a, 'hex');
    const bufB = Buffer.from(b, 'hex');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  },

  /**
   * Encrypts a secret at rest with AES-256-GCM, keyed by a 32-byte hex key
   * (`env.PAYMENT_GATEWAY_ENCRYPTION_KEY` — see `config/payment-gateway-encryption.ts`).
   * Used by `modules/client-billing`'s `FirmPaymentGatewaySettings` to store each firm's
   * own gateway `keySecret`/`webhookSecret` (PRD §12 "Encrypted secrets") — never plaintext,
   * and never the platform's own `RAZORPAY_KEY_SECRET` (a separate, unrelated credential).
   * Output is `iv:authTag:ciphertext`, each hex-encoded, so `decryptSecret` can split on `:`
   * without needing a fixed-width format.
   */
  encryptSecret(plainText: string, keyHex: string): string {
    const key = Buffer.from(keyHex, 'hex');
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':');
  },

  /** Inverse of `encryptSecret`. Throws if `payload` is malformed or the auth tag doesn't verify (tampered/wrong key). */
  decryptSecret(payload: string, keyHex: string): string {
    const [ivHex, authTagHex, dataHex] = payload.split(':');
    if (!ivHex || !authTagHex || !dataHex) {
      throw new Error('Malformed encrypted payload');
    }
    const key = Buffer.from(keyHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
    return decrypted.toString('utf8');
  },
};
