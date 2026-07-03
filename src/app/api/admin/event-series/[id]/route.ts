import { NextResponse } from "next/server";

import { requireAdminApi } from "@/src/lib/auth/requireAdminApi";
import { slugify } from "@/src/lib/slugify";
import { isValidHttpUrl } from "@/src/lib/validation/url";
import { validateSeriesLifecycleUpdate } from "@/src/lib/validation/eventSeriesLifecycle";
import { resolveEventManualLogoUrl } from "@/src/features/events/server/resolveEventManualLogoUrl";
import { scheduleEventSeriesLogoCleanupAfterPersist } from "@/src/features/events/server/eventSeriesLogoStorage";
import {
  getEventSeriesAdminById,
  updateEventSeries,
} from "@/src/features/events/server/eventSeriesAdmin";
import {
  getKeywordsForSeriesId,
  setSeriesKeywords,
} from "@/src/features/events/server/seriesKeywordsAdmin";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;

  try {
    const series = await getEventSeriesAdminById(id);
    if (!series) {
      return NextResponse.json({ ok: false, error: "Series not found." }, { status: 404 });
    }
    const keywords = await getKeywordsForSeriesId(id);
    return NextResponse.json({ ok: true, series, keywords });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

type PatchSeriesBody = {
  name?: string;
  slug?: string;
  description?: string | null;
  website_url?: string | null;
  logo_url?: string | null;
  keyword_ids?: string[];
  lifecycle_status?: string | null;
  lifecycle_note?: string | null;
  merged_into_series_id?: string | null;
};

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;

  let body: PatchSeriesBody;
  try {
    body = (await request.json()) as PatchSeriesBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  const errors: string[] = [];
  const patch: Record<string, unknown> = {};
  const warnings: string[] = [];
  let persistedLogoUrl: string | null | undefined;

  const existing = await getEventSeriesAdminById(id);
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Series not found." }, { status: 404 });
  }

  if (body.name !== undefined) {
    const name = body.name.trim();
    if (!name) errors.push("name cannot be empty");
    else patch.name = name;
  }
  if (body.slug !== undefined) {
    const slug = slugify(body.slug.trim());
    if (!slug) errors.push("slug cannot be empty");
    else patch.slug = slug;
  }
  if (body.description !== undefined) patch.description = body.description;
  if (body.website_url !== undefined) {
    const website = body.website_url?.trim() || null;
    if (website && !isValidHttpUrl(website)) errors.push("website_url must be a valid URL");
    else patch.website_url = website;
  }

  const hasLifecycleField =
    body.lifecycle_status !== undefined ||
    body.lifecycle_note !== undefined ||
    body.merged_into_series_id !== undefined;

  if (hasLifecycleField) {
    const lifecycle = validateSeriesLifecycleUpdate(
      {
        lifecycle_status: existing.lifecycle_status,
        lifecycle_note: existing.lifecycle_note,
        merged_into_series_id: existing.merged_into_series_id,
      },
      {
        lifecycle_status: body.lifecycle_status,
        lifecycle_note: body.lifecycle_note,
        merged_into_series_id: body.merged_into_series_id,
      },
      id,
    );
    if (!lifecycle.ok) {
      errors.push(...lifecycle.errors);
    } else {
      Object.assign(patch, lifecycle.patch);
    }
  }

  if (body.logo_url !== undefined) {
    const logoInput = body.logo_url?.trim() || null;
    if (logoInput && !isValidHttpUrl(logoInput)) {
      errors.push("logo_url must be a valid URL");
    } else {
      const resolved = await resolveEventManualLogoUrl({
        incomingLogoUrl: logoInput,
        existingLogoUrl: existing.logo_url,
        seriesId: id,
      });

      if (!resolved.ok) {
        warnings.push(resolved.warning);
      } else if (resolved.applyPatch) {
        patch.logo_url = resolved.logo_url;
        if (resolved.persistedLogoUrl !== undefined) {
          persistedLogoUrl = resolved.persistedLogoUrl;
        }
      }
    }
  }

  if (errors.length > 0) {
    return NextResponse.json({ ok: false, error: errors.join("; ") }, { status: 400 });
  }

  try {
    let series;
    if (Object.keys(patch).length === 0) {
      series = existing;
      if (warnings.length === 0) {
        return NextResponse.json({ ok: false, error: "No fields to update." }, { status: 400 });
      }
    } else {
      series = await updateEventSeries(id, patch as Parameters<typeof updateEventSeries>[1]);
      if (persistedLogoUrl !== undefined) {
        scheduleEventSeriesLogoCleanupAfterPersist({
          seriesId: id,
          publicUrl: persistedLogoUrl,
        });
      }
    }

    if (Array.isArray(body.keyword_ids)) {
      await setSeriesKeywords(id, body.keyword_ids);
    }
    const keywords = await getKeywordsForSeriesId(id);
    return NextResponse.json({
      ok: true,
      series,
      keywords,
      ...(warnings.length > 0 ? { warnings } : {}),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
