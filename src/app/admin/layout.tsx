import { redirect } from "next/navigation";

import { LayoutShell } from "@/src/components/layout/LayoutShell";
import { getProfileRoleForUserId, isAdminRole } from "@/src/lib/auth/appProfile";
import { createPageMetadata } from "@/src/lib/metadata/site";
import { getMarketingNavSession } from "@/src/lib/auth/marketingSession";
import { createClient } from "@/src/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata({
  title: "Admin",
  path: "/admin",
});

export default async function AdminRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const role = await getProfileRoleForUserId(supabase, user.id);
  if (!isAdminRole(role)) {
    redirect("/");
  }

  const session = await getMarketingNavSession();
  const adminEmail =
    typeof user.email === "string" && user.email.trim() !== ""
      ? user.email.trim()
      : user.id;

  return (
    <LayoutShell mode="admin" session={session} adminEmail={adminEmail}>
      {children}
    </LayoutShell>
  );
}
