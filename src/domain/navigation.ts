export type NavItem = {
  href: string;
  label: string;
};

export const mainNavigation: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/store", label: "Store" },
  { href: "/about", label: "About us" },
  { href: "/queue", label: "Live" },
  { href: "/stats", label: "Stats" }
];

export function buildUserNavigation(role?: string | null): NavItem[] {
  if (role === "ADMIN" || role === "OWNER") {
    return [
      { href: "/admin", label: "Admin" },
      { href: "/admin/uploads", label: "Uploads" },
      { href: "/admin/products", label: "Products" },
      { href: "/admin/queue", label: "Queue" },
      { href: "/admin/history", label: "History" },
      { href: "/admin/filament", label: "Filament" },
      { href: "/admin/settings", label: "Settings" }
    ];
  }

  if (role) {
    return [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/store", label: "Store" },
      { href: "/upload", label: "Upload STL" },
      { href: "/orders", label: "Orders" },
      { href: "/profile", label: "Profile" }
    ];
  }

  return [{ href: "/login", label: "Sign in" }];
}
