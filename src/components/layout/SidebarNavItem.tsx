import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Building,
  Building2,
  CalendarDays,
  CalendarRange,
  Compass,
  LayoutDashboard,
  MapPin,
  UploadCloud,
} from "lucide-react";

import type { SidebarNavIconKey } from "@/src/lib/constants/navigation";
import {
  sidebarNavItemActiveClass,
  sidebarNavItemBaseClass,
  sidebarNavItemInactiveClass,
} from "@/src/lib/design/classes";

const sidebarNavIcons: Record<SidebarNavIconKey, LucideIcon> = {
  compass: Compass,
  "calendar-days": CalendarDays,
  "building-2": Building2,
  "layout-dashboard": LayoutDashboard,
  "calendar-range": CalendarRange,
  "upload-cloud": UploadCloud,
  building: Building,
  "map-pin": MapPin,
};

type SidebarNavItemProps = {
  href: string;
  label: string;
  active: boolean;
  icon?: SidebarNavIconKey;
};

export function SidebarNavItem({ href, label, active, icon }: SidebarNavItemProps) {
  const Icon = icon ? sidebarNavIcons[icon] : null;

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={[
        sidebarNavItemBaseClass,
        active ? sidebarNavItemActiveClass : sidebarNavItemInactiveClass,
      ].join(" ")}
    >
      {Icon ? (
        <Icon
          aria-hidden
          className={[
            "size-5 shrink-0",
            active ? "text-brand-primary" : "text-slate-400",
          ].join(" ")}
          strokeWidth={2}
        />
      ) : null}
      <span className="truncate">{label}</span>
    </Link>
  );
}
