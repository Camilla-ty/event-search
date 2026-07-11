import { Badge } from "@/src/components/common";

type CompanyAdminStatusBadgeProps = {
  status: string;
  restrictedAt?: string | null;
};

export function CompanyAdminStatusBadge({
  status,
  restrictedAt = null,
}: CompanyAdminStatusBadgeProps) {
  const badges = [];

  if (restrictedAt !== null) {
    badges.push(
      <Badge key="restricted" variant="neutral">
        Restricted
      </Badge>,
    );
  }

  if (status === "merged") {
    badges.push(
      <Badge key="merged" variant="neutral">
        Merged
      </Badge>,
    );
  }

  if (badges.length === 0) return null;

  return <>{badges}</>;
}
