# SuperPrint Merchant Mobile

Native merchant-only iPhone app for Apple Tap to Pay on iPhone review.

This app is separate from `apps/admin-mobile`. Merchants can:
- sign in with their main `print.superk.studio` account,
- submit a merchant application,
- complete Stripe Connect hosted onboarding,
- upload private review documents,
- enable Tap to Pay on iPhone,
- review merchant education,
- manage their store products,
- take Tap to Pay on iPhone payments,
- see recent in-person orders.

## Environment

Backend:

```bash
STRIPE_SECRET_KEY="sk_..."
STRIPE_TERMINAL_LOCATION_ID="tml_..."
SUPERPRINT_FIELD_ENCRYPTION_KEY="openssl-rand-base64-32"
```

Expo review build:

```bash
EXPO_PUBLIC_SUPERPRINT_URL="https://print.superk.studio"
```

## Builds

Use EAS profiles from this directory:

```bash
npx eas build --platform ios --profile review
npx eas build --platform ios --profile production
```

Before building, confirm the Apple provisioning profile for `studio.superk.superprint.merchant` includes the Tap to Pay on iPhone entitlement.

## Review Recording

Use `docs/apple-tap-to-pay-review.md` for the exact Apple video scripts and checklist mapping.
