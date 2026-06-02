export type NavItem = {
  href: string;
  label: string;
};

export const publicNavItems: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/sponsors", label: "Sponsor Search" },
  { href: "/events", label: "Event Explorer" },
];

export const adminNavItems: NavItem[] = [
  { href: "/admin", label: "Admin Home" },
  { href: "/admin/companies/new", label: "Create Company" },
  { href: "/admin/events/new", label: "Create Event" },
];
