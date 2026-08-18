import { CryptoUtils } from '@shared/utils';

/**
 * `encryptSecret`/`decryptSecret` — Unit Tests (PRD §12 "Encrypted secrets",
 * used by `modules/client-billing`'s `FirmPaymentGatewaySettings`).
 */
describe('CryptoUtils.encryptSecret / decryptSecret', () => {
  const KEY = 'efc3a6a7f7e8d1f0a6aa8631a3efb4253514159317fc6ead198844a5182941e2'; // 32 bytes, hex
  const OTHER_KEY = 'f5787aa4aa38c62c365de26cedb94254f01a8d4aeec14235e44abe8230827b6b';

  it('round-trips plaintext through encrypt -> decrypt', () => {
    const plainText = 'rzp_live_super_secret_key';
    const encrypted = CryptoUtils.encryptSecret(plainText, KEY);

    expect(encrypted).not.toContain(plainText);
    expect(CryptoUtils.decryptSecret(encrypted, KEY)).toBe(plainText);
  });

  it('produces a different ciphertext each time (random IV) even for the same plaintext', () => {
    const a = CryptoUtils.encryptSecret('same-secret', KEY);
    const b = CryptoUtils.encryptSecret('same-secret', KEY);

    expect(a).not.toBe(b);
    expect(CryptoUtils.decryptSecret(a, KEY)).toBe('same-secret');
    expect(CryptoUtils.decryptSecret(b, KEY)).toBe('same-secret');
  });

  it('throws when decrypting with the wrong key (auth tag mismatch)', () => {
    const encrypted = CryptoUtils.encryptSecret('rzp_secret', KEY);
    expect(() => CryptoUtils.decryptSecret(encrypted, OTHER_KEY)).toThrow();
  });

  it('throws on a malformed payload missing the iv:authTag:ciphertext parts', () => {
    expect(() => CryptoUtils.decryptSecret('not-a-valid-payload', KEY)).toThrow('Malformed encrypted payload');
  });

  it('throws when the ciphertext has been tampered with', () => {
    const encrypted = CryptoUtils.encryptSecret('rzp_secret', KEY);
    const [iv, authTag, data] = encrypted.split(':');
    const tampered = [iv, authTag, `${data.slice(0, -2)}ff`].join(':');

    expect(() => CryptoUtils.decryptSecret(tampered, KEY)).toThrow();
  });
});
