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
};
