import { marketingNavItems } from "@/src/lib/constants/navigation";
import { Navbar } from "@/src/components/layout/Navbar";

export function MainNav() {
  return (
    <Navbar
      brand={<span>HandsShakes</span>}
      items={marketingNavItems}
      orientation="vertical"
    />
  );
}
