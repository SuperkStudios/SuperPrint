# Apple Tap to Pay on iPhone Review Package

Source files reviewed:
- `Getting Started App Requirements and Review 1_6.pdf`
- `App Review Requirements Checklist 1_6.numbers`

## App Target

Record and submit the native iOS app target:
- App: `SuperPrint Merchant`
- Bundle ID: `studio.superk.superprint.merchant`
- Entitlement: `com.apple.developer.proximity-reader.payment.acceptance`
- PSP: Stripe Terminal React Native SDK
- Region: US

The merchant-only target lives in `apps/merchant-mobile` and uses dedicated `/api/merchant/terminal/*` endpoints protected by `MERCHANT_APP_REVIEW_TOKEN`.

SuperPrint also has Tap to Pay enabled in the owner/admin app for internal counter sales:
- App: `SuperPrint Admin`
- Bundle ID: `studio.superk.superprint.admin`
- Purpose: SuperPrint owner/admin POS checkout only, not third-party merchant onboarding.

If Apple asks for merchant onboarding, enablement, education, or checkout recordings, use `SuperPrint Merchant`. If Apple asks whether SuperPrint staff can also take payments, use `SuperPrint Admin` POS checkout as a separate internal workflow.

## What Was Added

- A dedicated merchant-only native iOS app.
- In-app account/merchant onboarding fields and approval handoff.
- Existing merchant awareness, enablement, terms acceptance trigger, and education.
- Store/product management and recent order views.
- POS checkout support for `Tap to Pay on iPhone` using Stripe Terminal `card_present` PaymentIntents.
- Owner/admin POS support for Tap to Pay on iPhone in `apps/admin-mobile`.
- Checkout status states for initialization, card presentation, processing, approval, and failure.
- Email receipt support on Terminal PaymentIntents via `receipt_email`.
- iOS Proximity Reader entitlement in Expo config.

## Recording 1: New Merchant Onboarding

Goal: show a new merchant can discover and complete onboarding in-app.

1. Launch `SuperPrint Merchant` on a compatible iPhone.
2. Open `Settings`, enter the SuperPrint URL and merchant review token if they are not already configured.
3. Open `Onboard`.
4. Show the `Merchant Onboarding` form.
5. Enter business name, owner name, owner email, phone, and Tax ID last 4.
6. Tap `Submit Merchant Application`.
7. Wait for the approved status.
8. Show that the same screen immediately offers `Enable Tap to Pay on iPhone`.

Notes for Apple:
- This is the in-app path for a new merchant to become eligible for in-person payment acceptance.
- PSP approval is represented in the review build by the approval state; production approval is handled by Stripe onboarding/KYC.

## Recording 2: Enablement and Merchant Education

Goal: show an existing approved merchant can discover, enable, accept terms, and find education later.

1. Open `Tap to Pay`.
2. Show the visible awareness/enablement panel.
3. Tap `Enable Tap to Pay on iPhone`.
4. Allow the Apple/Stripe terms flow if presented.
5. Show the status changing through initialization/configuration.
6. Show the `Merchant education` section.
7. Show education for contactless cards, Apple Pay/digital wallets, PIN privacy, fallback, and digital receipts.
8. Toggle `Merchant education complete`.
9. Tap `Go to Checkout`.

Notes for Apple:
- Terms acceptance is triggered through Stripe Terminal `easyConnect` with `tosAcceptancePermitted`.
- The app initializes the Terminal SDK on screen load and shows an `Initializing Tap to Pay on iPhone...` state while preparing.
- Merchant education remains available from the dashboard through the `Tap to Pay` screen.

## Recording 3: Checkout

Goal: show cart/order entry, payment options, the Tap to Pay button, successful payment, and receipt path.

Important: record this video with another device. Apple payment UI screens may not appear in iOS screen recordings.

1. Open `Take Order`.
2. Enter customer name and email.
3. Select or enter a product, quantity, color/material, and price.
4. Select pickup or shipping and estimate fulfillment if needed.
5. In the payment selector, choose `Tap to Pay`.
6. Tap `Tap to Pay on iPhone`.
7. Show the initializing state if it appears.
8. Present a contactless card or Apple Pay/digital wallet.
9. Show processing.
10. Show the approved result.
11. Show the message that a digital receipt is sent to the customer email.

## App Store Connect Review Notes

Use this summary in the review notes:

SuperPrint Merchant is a merchant-only point-of-sale and store management app. The app uses Stripe Terminal as the approved PSP for Tap to Pay on iPhone in the US. Merchants can complete account setup, manage products, enable Tap to Pay on iPhone, review merchant education, and accept in-person contactless payments from the native iPhone app without a separate reader.

Test account:
- Provide the merchant review token configured in `MERCHANT_APP_REVIEW_TOKEN`.
- No owner/admin credentials are required for this merchant app review path.

Configuration:
- Stripe keys and Terminal location ID are managed in SuperPrint admin settings.
- The iOS app loads `/api/merchant/terminal/config` and uses `/api/merchant/terminal/*` endpoints for connection tokens, PaymentIntent creation, and completion.

## Checklist Mapping

- 1.1: Compatible iPhone support is required by Tap to Pay reader support checks.
- 1.4: Unsupported device/iOS errors are surfaced to the merchant.
- 1.5: Terminal SDK initialization runs on POS and Tap to Pay screen load.
- 1.6: Terms/reader state is handled by Stripe/Apple SDK calls, not a local-only acceptance flag.
- 1.7: Merchant token/profile data is kept in iOS secure storage.
- 2.1-2.3: `Onboard` provides the new merchant onboarding path.
- 3.1-3.7: `Tap to Pay` provides awareness, enablement, terms trigger, settings-style access, and checkout access.
- 3.8: Terms are enabled only after approved merchant onboarding.
- 3.9.1 and 5.7: Initialization/configuration progress is surfaced in status text.
- 4.1-4.8: Merchant education appears after enablement and remains available in `Tap to Pay`.
- 5.1-5.4: POS payment selector includes a prominent `Tap to Pay` option and button.
- 5.6: Reader is initialized before checkout and connected through Stripe Terminal.
- 5.8-5.9: App shows processing and approved/failed outcomes.
- 5.10: Terminal PaymentIntent includes `receipt_email`; app shows receipt delivery to the customer email.
- 5.11: US launch means fallback/PIN regional requirements are limited to the education text currently shown.

## Before Submitting

- Use a real compatible iPhone, not Simulator, for checkout recording.
- Confirm `stripe.terminalLocationId` starts with `tml_`.
- Confirm the provisioning profile includes `com.apple.developer.proximity-reader.payment.acceptance`.
- Set `MERCHANT_APP_REVIEW_TOKEN` on the deployed web app and `EXPO_PUBLIC_SUPERPRINT_MERCHANT_TOKEN` for the review build.
- Reset Tap to Pay terms in Apple Business Connect if you need to re-record first-time terms acceptance.
- Do not use custom Tap to Pay marketing images outside Apple-approved toolkit assets.
