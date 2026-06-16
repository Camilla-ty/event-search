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

/** Admin workspace primary sidebar. */
export const adminPrimaryNavItems: NavItem[] = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/events", label: "Events" },
  { href: "/admin/sponsor-imports", label: "Sponsor imports" },
  { href: "/admin/companies", label: "Companies" },
];

/** Events section secondary nav (shown under Events routes). */
export const adminEventsSubNavItems: NavItem[] = [
  { href: "/admin/events", label: "Overview" },
  { href: "/admin/events/series", label: "Series" },
  { href: "/admin/events/editions", label: "Editions" },
  { href: "/admin/events/editions/new", label: "Create edition" },
];

/** @deprecated Use adminPrimaryNavItems */
export const adminNavItems: NavItem[] = adminPrimaryNavItems;
