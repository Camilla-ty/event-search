"use client";

import { useMemo, useState } from "react";

import { AddCityModal } from "@/src/features/locations/components/AddCityModal";
import type { CityOption } from "@/src/features/locations/server/locationAdmin";
import { formInputClass } from "@/src/lib/design/classes";

type AdminCitySelectProps = {
  label?: string;
  value: string;
  onChange: (cityId: string) => void;
  initialCities: CityOption[];
  disabled?: boolean;
  emptyLabel?: string;
};

function sortCityOptions(options: CityOption[]): CityOption[] {
  return [...options].sort((a, b) => a.label.localeCompare(b.label));
}

export function AdminCitySelect({
  label = "City",
  value,
  onChange,
  initialCities,
  disabled = false,
  emptyLabel = "No city",
}: AdminCitySelectProps) {
  const [cityOptions, setCityOptions] = useState<CityOption[]>(initialCities);
  const [addModalOpen, setAddModalOpen] = useState(false);

  const sortedOptions = useMemo(() => sortCityOptions(cityOptions), [cityOptions]);

  function handleCityCreated(city: CityOption) {
    setCityOptions((prev) => {
      if (prev.some((row) => row.id === city.id)) return prev;
      return sortCityOptions([...prev, city]);
    });
    onChange(city.id);
  }

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-slate-700">{label}</span>
          <button
            type="button"
            onClick={() => setAddModalOpen(true)}
            disabled={disabled}
            className="text-sm text-brand-primary hover:underline disabled:opacity-50"
          >
            Add city
          </button>
        </div>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled || sortedOptions.length === 0}
          className={formInputClass}
        >
          <option value="">{sortedOptions.length === 0 ? "No cities available" : emptyLabel}</option>
          {sortedOptions.map((city) => (
            <option key={city.id} value={city.id}>
              {city.label}
            </option>
          ))}
        </select>
      </div>

      <AddCityModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onCreated={handleCityCreated}
      />
    </>
  );
}
