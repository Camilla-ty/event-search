import { LayoutShell } from "@/src/components/layout/LayoutShell";
import { LOGGED_OUT_NAV_SESSION } from "@/src/lib/auth/marketingSession";

export default function LoginRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LayoutShell mode="auth" session={LOGGED_OUT_NAV_SESSION}>
      {children}
    </LayoutShell>
  );
}
