export type NavItem = {
  href: string;
  label: string;
  permission?: StaffPermission;
};

export const staffPermissions = [
  "dashboard",
  "queue",
  "orders",
  "support",
  "uploads",
  "products",
  "filament",
  "printers",
  "maintenance",
  "factory",
  "history",
  "settings",
  "staff"
] as const;

export type StaffPermission = (typeof staffPermissions)[number];

export const mainNavigation: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/store", label: "Store" },
  { href: "/about", label: "About us" },
  { href: "/queue", label: "Live" },
  { href: "/stats", label: "Stats" },
  { href: "/factory", label: "Factory" }
];

export const userNavigation: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/upload", label: "Upload STL" },
  { href: "/orders", label: "Orders" },
  { href: "/rewards", label: "Rewards" },
  { href: "/support", label: "Support" },
  { href: "/profile", label: "Profile" }
];

export const adminNavigation: NavItem[] = [
  { href: "/admin", label: "Dashboard", permission: "dashboard" },
  { href: "/admin/queue", label: "Queue", permission: "queue" },
  { href: "/admin/pos", label: "In-person POS", permission: "orders" },
  { href: "/admin/merchants", label: "Merchants", permission: "orders" },
  { href: "/admin/orders", label: "Orders", permission: "orders" },
  { href: "/admin/support", label: "Support", permission: "support" },
  { href: "/admin/uploads", label: "Uploads", permission: "uploads" },
  { href: "/admin/products", label: "Products", permission: "products" },
  { href: "/admin/parts", label: "Parts", permission: "products" },
  { href: "/admin/filament", label: "Filament", permission: "filament" },
  { href: "/admin/printers", label: "Printers", permission: "printers" },
  { href: "/admin/maintenance", label: "Maintenance", permission: "maintenance" },
  { href: "/admin/factory", label: "Factory Evolution", permission: "factory" },
  { href: "/admin/history", label: "History", permission: "history" },
  { href: "/admin/staff", label: "Staff", permission: "staff" },
  { href: "/admin/settings", label: "Settings", permission: "settings" }
];

export function buildUserNavigation(role?: string | null): NavItem[] {
  if (role) {
    return userNavigation;
  }

  return [{ href: "/login", label: "Sign in" }];
}

export function buildAdminNavigation(role?: string | null, permissions?: unknown): NavItem[] {
  if (role === "OWNER" || role === "ADMIN") return adminNavigation;
  if (role !== "STAFF") return [];
  const allowed = new Set(Array.isArray(permissions) ? permissions.map(String) : []);
  return adminNavigation.filter((item) => item.permission && allowed.has(item.permission));
}
