import { Badge } from "@/src/components/common";

type CompanyAdminStatusBadgeProps = {
  status: string;
};

export function CompanyAdminStatusBadge({ status }: CompanyAdminStatusBadgeProps) {
  if (status === "merged") {
    return <Badge variant="neutral">Merged</Badge>;
  }

  return null;
}
