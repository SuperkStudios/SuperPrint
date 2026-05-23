# Apple Tap to Pay on iPhone Review Packet

Case-ID: 20111561

## Apps

| App | Bundle ID | Distribution intent | Tap to Pay review build |
| --- | --- | --- | --- |
| SuperPrint Admin | `studio.superk.superprint.admin` | Apple Business Manager / private company use | Local Apple Development device build |
| SuperPrint Merchant | `studio.superk.superprint.merchant` | Public App Store merchant app | Local Apple Development device build |

Apple granted the Tap to Pay on iPhone entitlement with the development distribution restriction. These builds are for registered test devices only until Apple grants the publishing entitlement.

## Local Review Build Commands

Use Release configuration so the JavaScript bundle is embedded and the app does not depend on Metro.

```sh
cd /Users/beesting50/Desktop/Code/SuperPrint/apps/admin-mobile
xcodebuild -workspace ios/SuperPrintAdmin.xcworkspace \
  -scheme SuperPrintAdmin \
  -configuration Release \
  -destination 'platform=iOS,name=Keenan’s iPhone' \
  -allowProvisioningUpdates \
  DEVELOPMENT_TEAM=JN8NQGXQW9 \
  build

ADMIN_APP="$(find ~/Library/Developer/Xcode/DerivedData -path '*Build/Products/Release-iphoneos/SuperPrintAdmin.app' -type d | tail -n 1)"
xcrun devicectl device install app --device 15324065-6729-5FD8-B5F5-5A77CDA52E87 "$ADMIN_APP"

cd /Users/beesting50/Desktop/Code/SuperPrint/apps/merchant-mobile
EXPO_PUBLIC_SUPERPRINT_URL=https://print.superk.studio xcodebuild -workspace ios/SuperPrintMerchant.xcworkspace \
  -scheme SuperPrintMerchant \
  -configuration Release \
  -destination 'platform=iOS,name=Keenan’s iPhone' \
  -allowProvisioningUpdates \
  DEVELOPMENT_TEAM=JN8NQGXQW9 \
  build

MERCHANT_APP="$(find ~/Library/Developer/Xcode/DerivedData -path '*Build/Products/Release-iphoneos/SuperPrintMerchant.app' -type d | tail -n 1)"
xcrun devicectl device install app --device 15324065-6729-5FD8-B5F5-5A77CDA52E87 "$MERCHANT_APP"
```

Verify signed entitlements:

```sh
codesign -d --entitlements :- "$ADMIN_APP" 2>/dev/null | plutil -p -
codesign -d --entitlements :- "$MERCHANT_APP" 2>/dev/null | plutil -p -
```

Expected entitlement in both outputs:

```text
"com.apple.developer.proximity-reader.payment.acceptance" => true
```

## Credential Setup Before Recording

Production platform URL: `https://print.superk.studio`

Set Stripe to test mode in SuperPrint Admin settings before recording:

| Setting | Value |
| --- | --- |
| Stripe mode | `test` |
| Publishable key | Stripe test publishable key |
| Secret key | Stripe test secret key |
| Webhook signing secret | Stripe test webhook secret |
| Terminal location ID | Stripe Terminal test location ID |

Do not record secret keys in the video. Enter them before the recording or blur/cut that section.

## Required Videos

### 1. New User Flow

Record the Merchant app.

1. Launch SuperPrint Merchant.
2. Tap Create.
3. Create a new merchant user account.
4. Accept platform legal terms.
5. Open merchant onboarding.
6. Show business details fields:
   - Business name
   - Business type
   - Website URL
   - Tax ID / EIN or SSN path
   - Owner last four
   - Address and contact details
   - Document upload
7. Submit application.
8. Show pending/approval state.
9. Once approved, show Tap to Pay on iPhone awareness and education.
10. Show Try Checkout / Checkout path.

### 2. Existing User Flow

Record the Merchant app with an approved existing merchant account.

1. Launch SuperPrint Merchant.
2. Sign in with existing credentials.
3. Show Tap to Pay on iPhone awareness from home/status area.
4. Open education/settings/help area.
5. Show merchant education:
   - Contactless card placement
   - Apple Pay / digital wallets
   - PIN privacy/accessibility guidance
   - Fallback to another contactless card or wallet
   - Digital receipt
6. Start enabling Tap to Pay on iPhone.
7. Show Apple/Stripe Terms and Conditions prompt if it appears.
8. Show configuration/initializing status if setup is still preparing.

### 3. Checkout Flow

Record the physical iPhone with another camera. Apple's Tap to Pay UI does not appear correctly in iOS screen recordings.

1. Launch an approved/signed-in Merchant app.
2. Open Checkout.
3. Select a store item or enter an amount.
4. Enter customer receipt email.
5. Show the Tap to Pay on iPhone button.
6. Tap Tap to Pay on iPhone.
7. Show initializing/preparing state if visible.
8. Present a Stripe test contactless card or test wallet.
9. Show Apple Tap to Pay UI.
10. Show processing state.
11. Show approved result.
12. Show digital receipt confirmation.

## Checklist Answers

| Requirement | Status | SuperPrint answer |
| --- | --- | --- |
| 1.1 | Yes | Apps support Tap to Pay on compatible iPhones; review device is iPhone 15 Pro Max. |
| 1.2 | Yes | iOS deployment target is 16.4, compatible with Stripe Terminal Tap to Pay requirements. |
| 1.3 | Yes | Merchant app targets iPhone; admin app supports iPhone/iPad but Tap to Pay is available on compatible iPhone devices. |
| 1.4 | Yes | Unsupported device/iOS is handled with a visible compatibility error before checkout. |
| 1.5 | Yes | Stripe Terminal SDK is initialized after sign-in, when the app returns to the foreground, on enablement, and on checkout screen load. |
| 1.6 | Yes | Terms and readiness state are handled through Stripe Terminal/Apple reader flow, not a local-only acceptance flag. |
| 1.7 | Yes | Secure storage is used for session persistence, and saved merchant sessions require Face ID, Touch ID, or device passcode unlock when biometrics are enrolled. |
| 1.8 | Yes | Merchant app follows native iOS-style patterns and uses the approved Tap to Pay wording. |
| 1.9 | Yes | External marketing will use Apple-approved toolkit assets only after general availability. |
| 2.1 | Yes | Merchant app has Create account and merchant application flow. |
| 2.2 | Yes | Merchant onboarding is in-app on iPhone. |
| 2.3 | Yes | Digital application is designed to be completed in under 15 minutes, with Stripe Connect handling KYC/merchant services. |
| 3.1 | Yes | Tap to Pay on iPhone is visible in merchant status, education, and checkout. |
| 3.2 | Yes | Merchant app shows a full-screen Tap to Pay on iPhone awareness modal once per signed-in merchant. |
| 3.3 | Yes | Merchant app displays Tap to Pay on iPhone awareness to eligible signed-in users at least once; external push campaign is planned for GA. |
| 3.4 | Yes | New merchant onboarding leads to education and checkout after approval. |
| 3.5 | Yes | Terms are triggered through the Stripe Terminal Tap to Pay enablement flow. |
| 3.6 | Yes | Merchant education/settings area provides access outside checkout. |
| 3.7 | Yes | Checkout triggers Tap to Pay enablement if needed. |
| 3.8 | Yes | Merchant business owner/admin account performs enablement. |
| 3.8.1 | Yes | Non-ready accounts see clear instructions to complete approval/onboarding first. |
| 3.8.2 | N/A | Merchant app is public App Store; admin private app will be distributed through Apple Business Manager. |
| 3.9 | Yes | Merchant education screen invites approved users to try checkout. |
| 3.9.1 | Yes | Enablement screen displays setup progress and initializing/preparing status while the Stripe Tap to Pay reader is configured. |
| 4.1 | PSP SDK dependent | Current merchant education is in-app and covers required topics. Add Apple ProximityReaderDiscovery if Stripe React Native exposes it for this integration. |
| 4.2 | Yes | Merchant education appears before checkout use. |
| 4.3 | Yes | Merchant education remains available in-app. |
| 4.4 | Yes | External marketing/education will use Apple's approved toolkit. |
| 4.5 | Yes | Education explains contactless card acceptance. |
| 4.6 | Yes | Education explains Apple Pay and other digital wallet acceptance. |
| 4.7 | Yes | Education includes PIN privacy guidance. |
| 4.8 | Yes | Education includes fallback to another contactless card or wallet. |
| 5.1 | Yes | Checkout includes a clear Tap to Pay on iPhone button. |
| 5.2 | Yes | Tap to Pay on iPhone is placed at the top of the checkout card before item details, amount, and receipt email fields. |
| 5.3 | Yes | Button/action can trigger enablement through the Stripe Terminal flow if terms are not accepted. |
| 5.4 | Yes | English US copy uses "Tap to Pay on iPhone". |
| 5.5 | N/A | Current buttons use text, not custom Tap to Pay iconography. |
| 5.6 | Yes | Reader initialization/warm-up occurs before collection; final timing should still be demonstrated in the checkout recording. |
| 5.7 | Yes | App displays initializing/preparing messages. |
| 5.8 | Yes | App displays processing state after card read/collection. |
| 5.9 | Yes | App displays approved/failure outcome. |
| 5.10 | Yes | Customer email is collected and digital receipt confirmation is shown. |
| 5.11 | Yes | Current launch target is United States; no UK/CA fallback or EU IFR requirements are in scope. |
| 6.1 | Approval dependent | Launch email will use Apple toolkit after publishing entitlement/general availability. |
| 6.2 | Yes / approval dependent | In-app splash awareness exists now; public launch marketing assets will use Apple toolkit after publishing entitlement/general availability. |
| 6.3 | Approval dependent | Push notification launch copy will use Apple toolkit after publishing entitlement/general availability. |

## Apple Reply Draft

```text
Hello,

Case-ID: 20111561

Our Tap to Pay on iPhone review materials are ready for review.

Bundle IDs:
- studio.superk.superprint.admin
- studio.superk.superprint.merchant

We uploaded:
1. New User Flow video
2. Existing User Flow video
3. Checkout Flow video
4. Completed App Review Requirements Checklist

Our PSP is Stripe, using Stripe Terminal / Tap to Pay on iPhone.

Thank you.
```
