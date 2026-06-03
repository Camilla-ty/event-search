export type NavItem = {
  href: string;
  label: string;
};

/** Apollo-style primary sidebar navigation. */
export const primaryNavItems: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/events", label: "Events Explorer" },
  { href: "/sponsors", label: "Sponsors Search" },
  { href: "/exhibitors", label: "Exhibitors" },
];

/** @deprecated Use primaryNavItems — kept for imports during migration. */
export const publicNavItems = primaryNavItems;

export const adminNavItems: NavItem[] = [
  { href: "/admin", label: "Admin Home" },
  { href: "/admin/companies/new", label: "Create Company" },
  { href: "/admin/events/new", label: "Create Event" },
];
