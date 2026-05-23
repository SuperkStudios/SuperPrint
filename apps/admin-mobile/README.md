# SuperPrint Admin Mobile

Native owner/admin app for internal POS, order operations, inventory, settings, and Tap to Pay on iPhone.

## Builds

Use EAS profiles from this directory:

```bash
npx eas build --platform ios --profile preview
npx eas build --platform ios --profile production
```

Before building, confirm the Apple provisioning profile for `studio.superk.superprint.admin` includes:

- Sign in with Apple
- Associated domains for `print.superk.studio`
- Tap to Pay on iPhone

The app defaults to `https://print.superk.studio` and can still be pointed at a local backend from the sign-in screen for development.
