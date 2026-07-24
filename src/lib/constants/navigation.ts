export type SidebarNavIconKey =
  | "compass"
  | "calendar-days"
  | "building-2"
  | "layout-dashboard"
  | "calendar-range"
  | "upload-cloud"
  | "building"
  | "map-pin";

export type NavItem = {
  href: string;
  label: string;
  icon?: SidebarNavIconKey;
};

/** Apollo-style primary sidebar navigation. */
export const primaryNavItems: NavItem[] = [
  { href: "/", label: "Discover", icon: "compass" },
  { href: "/events", label: "Events", icon: "calendar-days" },
  { href: "/sponsors", label: "Sponsors", icon: "building-2" },
];

/** @deprecated Use primaryNavItems — kept for imports during migration. */
export const publicNavItems = primaryNavItems;

/** Admin workspace primary sidebar. */
export const adminPrimaryNavItems: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: "layout-dashboard" },
  { href: "/admin/events", label: "Events", icon: "calendar-range" },
  { href: "/admin/sponsor-imports", label: "Sponsor imports", icon: "upload-cloud" },
  { href: "/admin/companies", label: "Companies", icon: "building" },
  { href: "/admin/venues", label: "Venues", icon: "map-pin" },
];

/** Events section secondary nav (shown under Events routes). */
export const adminEventsSubNavItems: NavItem[] = [
  { href: "/admin/events", label: "Overview" },
  { href: "/admin/events/series", label: "Event Brands" },
  { href: "/admin/events/editions", label: "Events" },
  { href: "/admin/events/editions/new", label: "Create event" },
];

/** @deprecated Use adminPrimaryNavItems */
export const adminNavItems: NavItem[] = adminPrimaryNavItems;
