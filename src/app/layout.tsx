import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getPlatformTheme } from "@/lib/platform-theme";

export const metadata: Metadata = {
  title: "SuperPrint",
  description: "Transparent live 3D print-on-demand manufacturing."
};

const nav = [
  { href: "/store", label: "Store" },
  { href: "/upload", label: "Upload STL" },
  { href: "/queue", label: "Live Queue" },
  { href: "/orders", label: "Orders" },
  { href: "/admin", label: "Admin" }
];

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const theme = await getPlatformTheme().catch(() => null);

  return (
    <html lang="en" style={theme?.cssVariables}>
      <body className="min-h-screen antialiased">
        <header className="sticky top-0 z-50 border-b bg-white/90 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span className="flex size-8 items-center justify-center rounded bg-primary text-sm text-primary-foreground">
                SP
              </span>
              SuperPrint
            </Link>
            <nav className="hidden items-center gap-5 text-sm text-muted-foreground md:flex">
              {nav.map((item) => (
                <Link key={item.href} href={item.href} className="hover:text-foreground">
                  {item.label}
                </Link>
              ))}
            </nav>
            <Link
              href="/login"
              className="rounded border px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              Sign in
            </Link>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
