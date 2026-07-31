import Razorpay from 'razorpay';
import { env } from './environment';

/**
 * Razorpay API client singleton — mirrors `config/storage.ts`'s pattern of
 * constructing unconditionally even when credentials are absent (the SDK
 * itself only fails when a call is actually made, not at construction).
 * `modules/billing/service/billing.service.ts` checks `razorpayConfig.isConfigured`
 * before using this client and throws a clear error otherwise, rather than
 * letting an obscure Razorpay auth error surface to the caller.
 */
export const razorpayClient = new Razorpay({
  key_id: env.RAZORPAY_KEY_ID ?? '',
  key_secret: env.RAZORPAY_KEY_SECRET ?? '',
});

export const razorpayConfig = {
  keyId: env.RAZORPAY_KEY_ID ?? '',
  /** Never sent to the client — only used server-side to verify a checkout's `order_id|payment_id` HMAC. */
  keySecret: env.RAZORPAY_KEY_SECRET ?? '',
  webhookSecret: env.RAZORPAY_WEBHOOK_SECRET,
  isConfigured: Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET),
} as const;
