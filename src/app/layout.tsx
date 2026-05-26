import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SuperPrint OS",
  description: "Open printer interconnect for slicing, dispatch, telemetry, and observable manufacturing.",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/apple-icon.png"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">{children}</body>
    </html>
  );
}
