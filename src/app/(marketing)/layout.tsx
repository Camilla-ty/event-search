import { LayoutShell } from "@/src/components/layout/LayoutShell";
import { getMarketingNavSession } from "@/src/lib/auth/marketingSession";
import { resolveBrowseLayoutMode } from "@/src/lib/layout/resolveLayoutMode";

type BrowseLayoutProps = {
  children: React.ReactNode;
};

export default async function BrowseLayout({ children }: BrowseLayoutProps) {
  const session = await getMarketingNavSession();
  const mode = resolveBrowseLayoutMode(session);

  return (
    <LayoutShell mode={mode} session={session}>
      {children}
    </LayoutShell>
  );
}
