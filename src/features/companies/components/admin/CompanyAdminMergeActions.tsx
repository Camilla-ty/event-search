import Link from "next/link";

import { secondaryCtaClass } from "@/src/lib/design/classes";

type CompanyAdminMergeActionsProps = {
  companyId: string;
};

export function CompanyAdminMergeActions({ companyId }: CompanyAdminMergeActionsProps) {
  return (
    <>
      <Link
        href={`/admin/companies/merge?canonical=${encodeURIComponent(companyId)}&mode=into`}
        className={`${secondaryCtaClass} h-10`}
      >
        Merge into this company
      </Link>
      <Link
        href={`/admin/companies/merge?duplicate=${encodeURIComponent(companyId)}&mode=away`}
        className={`${secondaryCtaClass} h-10`}
      >
        Merge this company away
      </Link>
    </>
  );
}
