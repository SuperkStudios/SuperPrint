import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

const footerGroups = [
  {
    title: "SuperPrint",
    links: [
      { href: "/", label: "Home" },
      { href: "/store", label: "Store" },
      { href: "/about", label: "About us" },
      { href: "/factory", label: "Factory" }
    ]
  },
  {
    title: "Production",
    links: [
      { href: "/upload", label: "Upload a model" },
      { href: "/queue", label: "Live queue" },
      { href: "/stats", label: "Factory stats" },
      { href: "/cart", label: "Cart" }
    ]
  },
  {
    title: "Account",
    links: [
      { href: "/login", label: "Sign in" },
      { href: "/dashboard", label: "Dashboard" },
      { href: "/orders", label: "Orders" },
      { href: "/profile", label: "Profile" },
      { href: "/support", label: "Support" }
    ]
  },
  {
    title: "Legal",
    links: [
      { href: "/legal#terms", label: "Terms" },
      { href: "/legal#privacy", label: "Privacy" },
      { href: "/legal#refunds", label: "Refunds" },
      { href: "/legal#supporters", label: "Supporters" }
    ]
  }
];

export function SiteFooter() {
  return (
    <footer className="border-t bg-background/92">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.1fr_2fr] lg:px-8">
        <div>
          <BrandLogo />
          <p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">
            Transparent 3D printing with a live queue, real printer telemetry, and a practical sustainability loop.
          </p>
          <p className="mt-6 text-xs uppercase tracking-[0.24em] text-muted-foreground">Live manufacturing. Transparent by design.</p>
        </div>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {footerGroups.map((group) => (
            <nav key={group.title} aria-label={group.title}>
              <h2 className="text-sm font-semibold">{group.title}</h2>
              <div className="mt-4 grid gap-3 text-sm text-muted-foreground">
                {group.links.map((link) => (
                  <Link key={link.href} href={link.href} className="transition hover:text-foreground">
                    {link.label}
                  </Link>
                ))}
              </div>
            </nav>
          ))}
        </div>
      </div>
      <div className="border-t">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <BrandLogo markOnly className="opacity-90" />
            <p>© {new Date().getFullYear()} SuperPrint. All rights reserved.</p>
          </div>
          <div className="flex flex-wrap gap-4">
            <Link href="/legal" className="hover:text-foreground">Legal center</Link>
            <Link href="/legal#privacy" className="hover:text-foreground">Privacy</Link>
            <Link href="/legal#contact" className="hover:text-foreground">Contact</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
