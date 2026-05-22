# SuperPrint Terminal Mobile

This is the native companion app path for using an iPhone itself as a Stripe Terminal Tap to Pay reader.

The web POS at `/admin/pos` can run on a phone browser, but Safari/Chrome cannot expose the iPhone NFC payment reader to Stripe Terminal. Stripe Tap to Pay on iPhone requires a native iOS app using the Stripe Terminal iOS SDK or the Stripe Terminal React Native SDK, plus Apple's Tap to Pay entitlement.

## Backend Endpoints

This app is designed to use the existing SuperPrint backend:

- `POST /api/admin/pos/terminal/connection-token`
- `GET /api/admin/pos/terminal/config`
- `POST /api/admin/pos/terminal/payment-intent`
- `POST /api/admin/pos/terminal/complete`

## Setup

1. Add Stripe keys in `/admin/settings`.
2. Add a Stripe Terminal location ID in `/admin/settings`; it must look like `tml_...`.
3. Request Apple's Tap to Pay on iPhone entitlement for `studio.superk.superprint.terminal`.
4. Set `EXPO_PUBLIC_SUPERPRINT_URL` to your reachable SuperPrint URL.
5. Replace the temporary sample-order product ID flow with a real order-selection screen or a handoff from the web POS.

The current app shell is intentionally small: it proves the backend contract and the Tap to Pay reader connection point. The next production pass should add native login, product lookup, and order selection.
