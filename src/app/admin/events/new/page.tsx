import NewEventEditionForm from "./NewEventEditionForm";
import { getCityOptions } from "@/src/features/companies/server/getCityOptions";
import { getSeriesOptions } from "@/src/features/events/server/getSeriesOptions";

export const dynamic = "force-dynamic";

export default async function NewEventEditionAdminPage() {
  let cities: Awaited<ReturnType<typeof getCityOptions>> = [];
  let series: Awaited<ReturnType<typeof getSeriesOptions>> = [];

  const [citiesResult, seriesResult] = await Promise.allSettled([
    getCityOptions(),
    getSeriesOptions(),
  ]);

  if (citiesResult.status === "fulfilled") cities = citiesResult.value;
  if (seriesResult.status === "fulfilled") series = seriesResult.value;

  return (
    <div className="mx-auto w-full max-w-xl">
      <NewEventEditionForm cities={cities} series={series} />
    </div>
  );
}
