import Link from "next/link";
import { redirect } from "next/navigation";

import { getProfileRoleForUserId, isAdminRole } from "@/src/lib/auth/appProfile";
import { createClient } from "@/src/lib/supabase/server";

import AdminLogoutButton from "./AdminLogoutButton";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin - HandShakes",
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Defense-in-depth: middleware already redirects unauthenticated requests, but if
  // middleware config drifts or is misconfigured this layer still fails closed.
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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 bg-white px-6 py-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3">
          <Link
            href="/admin"
            className="text-sm font-semibold text-slate-900 hover:text-slate-700 dark:text-slate-100 dark:hover:text-slate-300"
          >
            HandShakes Admin
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-slate-600 dark:text-slate-300 sm:inline">
              {user.email ?? user.id}
            </span>
            <AdminLogoutButton />
          </div>
        </div>
      </header>
      <div className="mx-auto w-full max-w-5xl">{children}</div>
    </div>
  );
}
