import NewCompanyForm from "./NewCompanyForm";
import { getCityOptions } from "@/src/features/companies/server/getCityOptions";

export const dynamic = "force-dynamic";

export default async function NewCompanyAdminPage() {
  let cities: Awaited<ReturnType<typeof getCityOptions>> = [];
  try {
    cities = await getCityOptions();
  } catch {
    cities = [];
  }

  return (
    <div className="mx-auto w-full max-w-xl">
      <NewCompanyForm cities={cities} />
    </div>
  );
}
