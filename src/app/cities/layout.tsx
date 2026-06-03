import { LayoutShell } from "@/src/components/layout/LayoutShell";
import { getMarketingNavSession } from "@/src/lib/auth/marketingSession";
import { resolveBrowseLayoutMode } from "@/src/lib/layout/resolveLayoutMode";

export default async function CitiesRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getMarketingNavSession();
  const mode = resolveBrowseLayoutMode(session);

  return (
    <LayoutShell mode={mode} session={session}>
      {children}
    </LayoutShell>
  );
}
