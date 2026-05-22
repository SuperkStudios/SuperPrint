import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "SuperPrint Terminal",
  slug: "superprint-terminal",
  scheme: "superprint-terminal",
  version: "0.1.0",
  orientation: "portrait",
  ios: {
    bundleIdentifier: "studio.superk.superprint.terminal",
    infoPlist: {
      NSLocationWhenInUseUsageDescription: "Location access is required to accept in-person payments.",
      NSBluetoothAlwaysUsageDescription: "Bluetooth is used to connect to supported Stripe readers.",
      NSBluetoothPeripheralUsageDescription: "Bluetooth is used to connect to supported Stripe readers."
    }
  },
  android: {
    package: "studio.superk.superprint.terminal",
    permissions: ["ACCESS_FINE_LOCATION", "BLUETOOTH", "BLUETOOTH_ADMIN", "BLUETOOTH_CONNECT", "NFC"]
  }
};

export default config;
