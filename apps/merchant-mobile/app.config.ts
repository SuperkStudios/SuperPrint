import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "SuperPrint",
  slug: "superprint-merchant",
  scheme: "superprint-merchant",
  version: "0.1.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  ios: {
    bundleIdentifier: "studio.superk.print",
    supportsTablet: false,
    entitlements: {
      "com.apple.developer.in-app-payments": ["merchant.studio.superk.print"],
      "com.apple.developer.proximity-reader.payment.acceptance": true
    },
    infoPlist: {
      NSLocationWhenInUseUsageDescription: "Location access is required to accept in-person payments with Tap to Pay on iPhone.",
      NSBluetoothAlwaysUsageDescription: "Bluetooth is used to connect to supported Stripe readers.",
      NSBluetoothPeripheralUsageDescription: "Bluetooth is used to connect to supported Stripe readers.",
      NFCReaderUsageDescription: "NFC is used for Tap to Pay on supported iPhones.",
      NSFaceIDUsageDescription: "Face ID is used to unlock your saved SuperPrint Merchant session."
    }
  },
  android: {
    package: "studio.superk.print",
    permissions: ["ACCESS_FINE_LOCATION", "BLUETOOTH", "BLUETOOTH_ADMIN", "BLUETOOTH_CONNECT", "NFC"]
  },
  plugins: [
    [
      "@stripe/stripe-react-native",
      {
        merchantIdentifier: "merchant.studio.superk.print",
        enableGooglePay: false
      }
    ],
    [
      "@stripe/stripe-terminal-react-native",
      {
        "bluetoothPeripheralPermission": "Bluetooth is used to connect to supported Stripe readers.",
        "bluetoothAlwaysUsagePermission": "Bluetooth is used to connect to supported Stripe readers.",
        "locationWhenInUsePermission": "Location access is required to accept in-person payments with Tap to Pay on iPhone."
      }
    ],
    "expo-secure-store"
  ]
};

export default config;
