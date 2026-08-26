"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { Button, InlineErrorBanner } from "@/src/components/common";
import { formatResearchPagePublicPath } from "@/src/features/research-pages/lib/formatResearchPagePublicPath";
import type { ResearchPageLocationType } from "@/src/features/research-pages/lib/researchPageLocation";
import { formInputClass, feedbackSuccessClass } from "@/src/lib/design/classes";

type SelectOption = { id: string; name: string; slug: string };

type CreateResearchPageFormProps = {
  topics: SelectOption[];
  regions: SelectOption[];
  countries: SelectOption[];
};

type ApiResponse = {
  ok: boolean;
  error?: string;
  page?: { id: string };
};

export function CreateResearchPageForm({
  topics,
  regions,
  countries,
}: CreateResearchPageFormProps) {
  const router = useRouter();
  const [topicId, setTopicId] = useState("");
  const [locationType, setLocationType] =
    useState<ResearchPageLocationType>("region");
  const [locationId, setLocationId] = useState("");
  const [yearInput, setYearInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const locationOptions = locationType === "country" ? countries : regions;
  const selectedTopic = topics.find((t) => t.id === topicId);
  const selectedLocation = locationOptions.find((l) => l.id === locationId);

  function handleLocationTypeChange(next: ResearchPageLocationType) {
    setLocationType(next);
    setLocationId("");
  }

  const parsedYear =
    yearInput.trim() === ""
      ? null
      : Number.isInteger(Number(yearInput)) &&
          Number(yearInput) >= 1990 &&
          Number(yearInput) <= 2100
        ? Number(yearInput)
        : undefined;

  const previewPath =
    selectedTopic && selectedLocation && parsedYear !== undefined
      ? formatResearchPagePublicPath(
          selectedTopic.slug,
          { type: locationType, slug: selectedLocation.slug },
          parsedYear,
        )
      : null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!topicId || !locationId) {
      setResult({
        ok: false,
        message: `Select both a topic and a ${locationType}.`,
      });
      return;
    }
    if (parsedYear === undefined) {
      setResult({
        ok: false,
        message: "Year must be blank (all years) or an integer between 1990 and 2100.",
      });
      return;
    }

    setResult(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/admin/research-pages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          topic_keyword_id: topicId,
          location_type: locationType,
          location_id: locationId,
          year: parsedYear,
        }),
      });
      const data = (await response.json()) as ApiResponse;

      if (!response.ok || !data.ok) {
        setResult({
          ok: false,
          message: data.error ?? "Failed to create research page.",
        });
        return;
      }

      setResult({ ok: true, message: "Research page created as Draft." });
      router.push("/admin/research-pages");
      router.refresh();
    } catch {
      setResult({ ok: false, message: "Request failed." });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border border-slate-200 bg-white p-6"
    >
      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-700">Topic</span>
        <select
          required
          value={topicId}
          onChange={(e) => setTopicId(e.target.value)}
          disabled={isSubmitting}
          className={formInputClass}
        >
          <option value="">Select a topic…</option>
          {topics.map((topic) => (
            <option key={topic.id} value={topic.id}>
              {topic.name}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-slate-700">
          Location type
        </legend>
        <div className="flex gap-4">
          {(["region", "country"] as const).map((option) => (
            <label key={option} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="location_type"
                value={option}
                checked={locationType === option}
                onChange={() => handleLocationTypeChange(option)}
                disabled={isSubmitting}
              />
              <span className="capitalize text-slate-700">{option}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block space-y-2">
        <span className="text-sm font-medium capitalize text-slate-700">
          {locationType}
        </span>
        <select
          required
          value={locationId}
          onChange={(e) => setLocationId(e.target.value)}
          disabled={isSubmitting}
          className={formInputClass}
        >
          <option value="">Select a {locationType}…</option>
          {locationOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-700">
          Year <span className="font-normal text-slate-500">(optional)</span>
        </span>
        <input
          type="number"
          inputMode="numeric"
          min={1990}
          max={2100}
          step={1}
          value={yearInput}
          onChange={(e) => setYearInput(e.target.value)}
          disabled={isSubmitting}
          placeholder="Leave blank for all years"
          className={formInputClass}
        />
        <span className="block text-xs text-slate-500">
          Leave blank for all years. Enter a year (1990–2100) for a year-scoped page.
        </span>
      </label>

      {previewPath ? (
        <p className="rounded-lg bg-slate-50 px-4 py-3 font-mono text-xs text-slate-600">
          Public URL (when published): {previewPath}
        </p>
      ) : null}

      <p className="text-sm text-slate-500">
        New research pages are created as <strong>Draft</strong>. They are not
        publicly accessible until published.
      </p>

      {result && !result.ok ? (
        <InlineErrorBanner message={result.message} />
      ) : null}
      {result?.ok ? (
        <p className={feedbackSuccessClass}>{result.message}</p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating…" : "Create as Draft"}
        </Button>
      </div>
    </form>
  );
}
