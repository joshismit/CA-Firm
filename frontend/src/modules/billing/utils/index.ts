// billing-scoped pure helper functions.
// Loads and drives Razorpay's Checkout.js widget - the only place in this module that touches
// `window` directly. Kept out of hooks/index.ts so the data-fetching layer stays framework-pure.

import type { CheckoutSession, VerifyCheckoutPaymentPayload } from '../types'

interface RazorpayCheckoutOptions {
  key: string
  amount: number
  currency: string
  order_id: string
  name: string
  description?: string
  handler: (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => void
  modal?: { ondismiss?: () => void }
  theme?: { color?: string }
}

interface RazorpayCheckoutInstance {
  open(): void
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayCheckoutInstance
  }
}

const CHECKOUT_SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js'

let scriptLoadPromise: Promise<void> | null = null

/** Injects Razorpay's Checkout.js exactly once, no matter how many times a checkout is opened. */
function loadRazorpayScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve()
  if (scriptLoadPromise) return scriptLoadPromise

  scriptLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = CHECKOUT_SCRIPT_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      scriptLoadPromise = null
      reject(new Error('Failed to load the Razorpay checkout script.'))
    }
    document.body.appendChild(script)
  })

  return scriptLoadPromise
}

/**
 * Opens Razorpay's hosted checkout modal for a session created by
 * `POST /subscription/checkout`. `onSuccess` receives exactly the fields
 * `POST /subscription/checkout/verify` expects - the caller just forwards them.
 */
export async function openRazorpayCheckout(
  session: CheckoutSession,
  onSuccess: (payload: VerifyCheckoutPaymentPayload) => void,
  onDismiss?: () => void,
): Promise<void> {
  await loadRazorpayScript()

  if (!window.Razorpay) {
    throw new Error('Razorpay checkout failed to load.')
  }

  const checkout = new window.Razorpay({
    key: session.razorpayKeyId,
    amount: session.amountInPaise,
    currency: session.currency,
    order_id: session.razorpayOrderId,
    name: 'CA Firm OS',
    description: 'Subscription payment',
    theme: { color: '#4f46e5' },
    handler: (response) => {
      onSuccess({
        razorpayOrderId: response.razorpay_order_id,
        razorpayPaymentId: response.razorpay_payment_id,
        razorpaySignature: response.razorpay_signature,
      })
    },
    modal: onDismiss ? { ondismiss: onDismiss } : undefined,
  })

  checkout.open()
}
