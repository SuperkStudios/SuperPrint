import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { mainNavigation } from "@/domain/navigation";
import { getCurrentSession } from "@/lib/auth";
import { getPlatformTheme } from "@/lib/platform-theme";
import { AppFrame } from "@/components/app-frame";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = {
  title: "SuperPrint",
  description: "Transparent live 3D print-on-demand manufacturing.",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/apple-icon.png",
    other: [
      { rel: "icon", url: "/brand/superprint-mark-light-32.png", media: "(prefers-color-scheme: light)", sizes: "32x32", type: "image/png" },
      { rel: "icon", url: "/favicon.png", media: "(prefers-color-scheme: dark)", sizes: "32x32", type: "image/png" },
      { rel: "icon", url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { rel: "icon", url: "/icon-512.png", sizes: "512x512", type: "image/png" }
    ]
  }
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [theme, session] = await Promise.all([getPlatformTheme().catch(() => null), getCurrentSession().catch(() => null)]);

  return (
    <html lang="en" style={theme?.cssVariables} suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => { try { const t = localStorage.getItem("superprint-theme") || "system"; const d = t === "dark" || (t === "system" && matchMedia("(prefers-color-scheme: dark)").matches); document.documentElement.classList.toggle("dark", d); document.documentElement.classList.toggle("light", !d); document.documentElement.dataset.theme = t; } catch (_) {} })();`
          }}
        />
        <header className="sticky top-0 z-50 border-b bg-background/88 backdrop-blur-xl">
          <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <Link href="/" className="flex items-center">
              <BrandLogo />
            </Link>
            <nav aria-label="Main navigation" className="order-3 flex w-full flex-wrap gap-3 text-sm text-muted-foreground md:order-none md:w-auto md:items-center md:gap-5">
              {mainNavigation.map((item) => (
                <Link key={item.href} href={item.href} className="hover:text-foreground">
                  {item.label}
                </Link>
              ))}
            </nav>
            <nav aria-label="Account actions" className="flex flex-wrap items-center justify-end gap-2">
              <ThemeToggle />
              {!session?.user.id ? (
                <Link
                  href="/login"
                  className="rounded bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
                >
                  Sign in
                </Link>
              ) : null}
            </nav>
          </div>
        </header>
        <AppFrame role={session?.user.role} staffPermissions={session?.user.staffPermissions}>
          {children}
        </AppFrame>
      </body>
    </html>
  );
}
