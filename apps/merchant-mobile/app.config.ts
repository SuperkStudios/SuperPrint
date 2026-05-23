import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "SuperPrint Merchant",
  slug: "superprint-merchant",
  scheme: "superprint-merchant",
  version: "0.1.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  ios: {
    bundleIdentifier: "studio.superk.superprint.merchant",
    supportsTablet: false,
    entitlements: {
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
    package: "studio.superk.superprint.merchant",
    permissions: ["ACCESS_FINE_LOCATION", "BLUETOOTH", "BLUETOOTH_ADMIN", "BLUETOOTH_CONNECT", "NFC"]
  },
  plugins: [
    [
      "@stripe/stripe-terminal-react-native",
      {
        "bluetoothPeripheralPermission": "Bluetooth is used to connect to supported Stripe readers.",
        "bluetoothAlwaysUsagePermission": "Bluetooth is used to connect to supported Stripe readers.",
        "locationWhenInUsePermission": "Location access is required to accept in-person payments with Tap to Pay on iPhone."
      }
    ],
    "expo-secure-store",
    "expo-document-picker"
  ]
};

export default config;
