import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/common";

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
    <section className="space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Admin Dashboard
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Manage HandShakes content from one place.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {adminActions.map((action) => (
          <Link key={action.href} href={action.href} className="block">
            <Card className="transition hover:border-slate-400 dark:hover:border-slate-600">
              <CardHeader>
                <CardTitle>{action.title}</CardTitle>
                <CardDescription>{action.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <span className="text-sm font-medium text-violet-600 dark:text-violet-400">
                  Open →
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
