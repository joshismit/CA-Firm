import { env } from './environment';

/**
 * Encryption key for `IntegrationConnection.encryptedCredentials` — mirrors
 * `config/payment-gateway-encryption.ts`'s `isConfigured` co-location
 * pattern exactly. Deliberately a separate config object/env var from
 * `paymentGatewayEncryptionConfig`: that one only ever encrypts a tenant's
 * OWN payment gateway secrets (`modules/client-billing`), this one only
 * ever encrypts a tenant's third-party integration credentials
 * (`modules/integrations`) — rotating one must never affect the other.
 */
export const integrationEncryptionConfig = {
  key: env.INTEGRATION_ENCRYPTION_KEY,
  isConfigured: Boolean(env.INTEGRATION_ENCRYPTION_KEY),
} as const;
