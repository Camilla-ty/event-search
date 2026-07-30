"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { Button, InlineErrorBanner } from "@/src/components/common";
import { formatResearchPagePublicPath } from "@/src/features/research-pages/lib/formatResearchPagePublicPath";
import { formInputClass, feedbackSuccessClass } from "@/src/lib/design/classes";

type SelectOption = { id: string; name: string; slug: string };

type CreateResearchPageFormProps = {
  topics: SelectOption[];
  regions: SelectOption[];
};

type ApiResponse = {
  ok: boolean;
  error?: string;
  page?: { id: string };
};

export function CreateResearchPageForm({
  topics,
  regions,
}: CreateResearchPageFormProps) {
  const router = useRouter();
  const [topicId, setTopicId] = useState("");
  const [regionId, setRegionId] = useState("");
  const [yearInput, setYearInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const selectedTopic = topics.find((t) => t.id === topicId);
  const selectedRegion = regions.find((r) => r.id === regionId);

  const parsedYear =
    yearInput.trim() === ""
      ? null
      : Number.isInteger(Number(yearInput)) &&
          Number(yearInput) >= 1990 &&
          Number(yearInput) <= 2100
        ? Number(yearInput)
        : undefined;

  const previewPath =
    selectedTopic && selectedRegion && parsedYear !== undefined
      ? formatResearchPagePublicPath(
          selectedTopic.slug,
          selectedRegion.slug,
          parsedYear,
        )
      : null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!topicId || !regionId) {
      setResult({ ok: false, message: "Select both a topic and a region." });
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
          region_id: regionId,
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

      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-700">Region</span>
        <select
          required
          value={regionId}
          onChange={(e) => setRegionId(e.target.value)}
          disabled={isSubmitting}
          className={formInputClass}
        >
          <option value="">Select a region…</option>
          {regions.map((region) => (
            <option key={region.id} value={region.id}>
              {region.name}
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
          {parsedYear !== null ? (
            <span className="mt-1 block text-amber-700">
              Note: year-scoped public routes ship in a later phase. Preview still
              shows all-years data until then.
            </span>
          ) : null}
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
