import { NextResponse } from "next/server";

import { requireAdminApi } from "@/src/lib/auth/requireAdminApi";
import { slugify } from "@/src/lib/slugify";
import { isValidHttpUrl } from "@/src/lib/validation/url";
import { validateSeriesLifecycleCreate } from "@/src/lib/validation/eventSeriesLifecycle";
import { resolveEventManualLogoUrl } from "@/src/features/events/server/resolveEventManualLogoUrl";
import { scheduleEventSeriesLogoCleanupAfterPersist } from "@/src/features/events/server/eventSeriesLogoStorage";
import {
  createEventSeries,
  listEventSeriesAdmin,
  updateEventSeries,
} from "@/src/features/events/server/eventSeriesAdmin";
import { setSeriesKeywords } from "@/src/features/events/server/seriesKeywordsAdmin";

export async function GET(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? undefined;

  try {
    const series = await listEventSeriesAdmin(search);
    return NextResponse.json({ ok: true, series });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

type CreateSeriesBody = {
  name?: string;
  slug?: string;
  description?: string | null;
  website_url?: string | null;
  logo_url?: string | null;
  keyword_ids?: string[];
  lifecycle_status?: string | null;
  merged_into_series_id?: string | null;
};

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  let body: CreateSeriesBody;
  try {
    body = (await request.json()) as CreateSeriesBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  const name = body.name?.trim() ?? "";
  const slug = slugify(body.slug?.trim() || name);
  const errors: string[] = [];

  if (!name) errors.push("name is required");
  if (!slug) errors.push("slug is required");

  const website = body.website_url?.trim() || null;
  const logoInput =
    body.logo_url === undefined ? null : body.logo_url?.trim() || null;
  if (website && !isValidHttpUrl(website)) errors.push("website_url must be a valid URL");
  if (logoInput && !isValidHttpUrl(logoInput)) errors.push("logo_url must be a valid URL");

  const lifecycle = validateSeriesLifecycleCreate({
    lifecycle_status: body.lifecycle_status,
    merged_into_series_id: body.merged_into_series_id,
  });
  if (!lifecycle.ok) {
    errors.push(...lifecycle.errors);
  }

  if (errors.length > 0) {
    return NextResponse.json({ ok: false, error: errors.join("; ") }, { status: 400 });
  }

  if (!lifecycle.ok) {
    return NextResponse.json({ ok: false, error: "Invalid lifecycle fields." }, { status: 400 });
  }

  try {
    let series = await createEventSeries({
      name,
      slug,
      description: body.description ?? null,
      website_url: website,
      logo_url: null,
      lifecycle_status: lifecycle.data.lifecycle_status,
      merged_into_series_id: lifecycle.data.merged_into_series_id,
    });

    const warnings: string[] = [];
    let persistedLogoUrl: string | null | undefined;

    if (logoInput) {
      const resolved = await resolveEventManualLogoUrl({
        incomingLogoUrl: logoInput,
        existingLogoUrl: null,
        seriesId: series.id,
      });
      if (resolved.ok && resolved.applyPatch) {
        series = await updateEventSeries(series.id, { logo_url: resolved.logo_url });
        if (resolved.persistedLogoUrl !== undefined) {
          persistedLogoUrl = resolved.persistedLogoUrl;
        }
      } else if (!resolved.ok) {
        warnings.push(resolved.warning);
      }
    }

    if (persistedLogoUrl !== undefined) {
      scheduleEventSeriesLogoCleanupAfterPersist({
        seriesId: series.id,
        publicUrl: persistedLogoUrl,
      });
    }

    if (Array.isArray(body.keyword_ids)) {
      await setSeriesKeywords(series.id, body.keyword_ids);
    }

    return NextResponse.json(
      { ok: true, series, ...(warnings.length > 0 ? { warnings } : {}) },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
