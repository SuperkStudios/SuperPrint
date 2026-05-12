import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import Link from "next/link";
import "./globals.css";
import { mainNavigation, buildUserNavigation } from "@/domain/navigation";
import { authOptions } from "@/lib/auth";
import { getPlatformTheme } from "@/lib/platform-theme";

export const metadata: Metadata = {
  title: "SuperPrint",
  description: "Transparent live 3D print-on-demand manufacturing."
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [theme, session] = await Promise.all([getPlatformTheme().catch(() => null), getServerSession(authOptions)]);
  const userNavigation = buildUserNavigation(session?.user.role);

  return (
    <html lang="en" style={theme?.cssVariables}>
      <body className="min-h-screen antialiased">
        <header className="sticky top-0 z-50 border-b bg-white/90 backdrop-blur">
          <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span className="flex size-8 items-center justify-center rounded bg-primary text-sm text-primary-foreground">
                SP
              </span>
              SuperPrint
            </Link>
            <nav aria-label="Main navigation" className="order-3 flex w-full flex-wrap gap-3 text-sm text-muted-foreground md:order-none md:w-auto md:items-center md:gap-5">
              {mainNavigation.map((item) => (
                <Link key={item.href} href={item.href} className="hover:text-foreground">
                  {item.label}
                </Link>
              ))}
            </nav>
            <nav aria-label="User navigation" className="flex flex-wrap items-center justify-end gap-2">
              {userNavigation.map((item, index) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={index === 0 ? "rounded bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90" : "rounded border px-3 py-2 text-sm font-medium hover:bg-muted"}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
