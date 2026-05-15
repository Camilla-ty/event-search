import type { ReactNode } from "react";

import { Navbar } from "@/src/components/layout/Navbar";
import { marketingNavItems } from "@/src/lib/constants/navigation";

type MainNavProps = {
  sessionSlot?: ReactNode;
};

export function MainNav({ sessionSlot }: MainNavProps) {
  return (
    <Navbar
      brand={<span>HandsShakes</span>}
      items={marketingNavItems}
      orientation="vertical"
      rightSlot={sessionSlot}
    />
  );
}
