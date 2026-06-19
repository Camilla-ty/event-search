import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/common";
import { PageHeader } from "@/src/components/common/explorer/PageHeader";
import { createPageMetadata } from "@/src/lib/metadata/site";

export const metadata = createPageMetadata({
  title: "Exhibitors",
  description:
    "Search and analyze exhibitor participation across events with EventPixels.",
  path: "/exhibitors",
});

export default function ExhibitorsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Exhibitors"
        description="Search and analyze exhibitor participation across events. Structured company and booth data will appear here as coverage expands."
      />
      <Card>
        <CardHeader>
          <CardTitle>Exhibitor directory</CardTitle>
          <CardDescription>
            Use Events and Sponsors for active intelligence today.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600">
            Exhibitor profiles, booth assignments, and cross-event participation views are on the
            roadmap for this module.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
