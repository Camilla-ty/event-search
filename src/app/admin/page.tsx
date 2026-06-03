import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/common";
import { BRAND_NAME } from "@/src/lib/design/brand";
import { brandLinkClass } from "@/src/lib/design/classes";

export const dynamic = "force-dynamic";

const adminActions = [
  {
    href: "/admin",
    title: "Admin Dashboard/Home",
    description: "Return to the central admin workspace and content actions.",
  },
  {
    href: "/admin/companies/new",
    title: "Create Company",
    description: "Add a company profile used across sponsor and event experiences.",
  },
  {
    href: "/admin/events/new",
    title: "Create Event",
    description: "Create a new event edition under an existing event series.",
  },
];

export default function AdminHomePage() {
  return (
    <section className="space-y-6">
      <header className="space-y-1 border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-semibold text-slate-900">Admin Dashboard</h1>
        <p className="text-sm text-slate-600">
          Manage {BRAND_NAME} data and content from one place.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {adminActions.map((action) => (
          <Link key={action.href} href={action.href} className="block">
            <Card className="transition hover:border-brand-primary/30">
              <CardHeader>
                <CardTitle>{action.title}</CardTitle>
                <CardDescription>{action.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <span className={`text-sm ${brandLinkClass}`}>Open →</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
