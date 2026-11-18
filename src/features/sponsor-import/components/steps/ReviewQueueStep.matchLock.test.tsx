import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import type { RowSummary, SponsorImportBatch, SponsorImportRow } from "../../client/types";
import { ImportFlowProgressProvider } from "../ImportFlowProgress";
import { SponsorImportWizardProvider } from "../SponsorImportWizardContext";
import { ReviewQueueStep } from "./ReviewQueueStep";

const BATCH_ID = "7fc09d71-0000-4000-8000-000000000001";

const batch: SponsorImportBatch = {
  id: BATCH_ID,
  event_edition_id: "edition-1",
  status: "review",
  processing_phase: null,
  source_filename: "sponsors.csv",
  source_file_storage_path: "path/sponsors.csv",
  source_file_format: "csv",
  source_sheet_name: null,
  source_row_count: 2,
  column_mapping: { company_name: "Company", website: "Website", tier_rank: "Tier", tier_label: "Label" },
  created_at: "2026-11-18T08:57:01.000Z",
  updated_at: "2026-11-18T08:57:01.000Z",
};

const staleSummary: RowSummary = {
  total: 2,
  needs_review: 2,
  auto_ready: 0,
  resolved: 0,
  excluded: 0,
  blocking_validation_count: 0,
  pending_duplicate_count: 0,
};

const persistedSummary: RowSummary = { ...staleSummary, needs_review: 1, auto_ready: 1 };

const needsReviewRow: SponsorImportRow = {
  id: "row-1",
  batch_id: BATCH_ID,
  excel_row_number: 2,
  raw_company_name: "Acme",
  raw_website: "https://acme.example",
  raw_tier_rank: 1,
  raw_tier_label: "Gold",
  normalized_company_name: "acme",
  normalized_website: "https://acme.example",
  normalized_domain: "acme.example",
  mapped_tier_rank: 1,
  mapped_tier_label: "Gold",
  status: "needs_review",
  validation_issues: [],
  has_blocking_validation: false,
  match_method: null,
  match_confidence: null,
  proposed_company_id: null,
  conflict_type: null,
  decision_type: null,
  resolved_company_id: null,
  duplicate_cluster_key: null,
  duplicate_role: null,
  duplicate_of_row_id: null,
  duplicate_resolution: null,
  already_on_live_sponsor_id: null,
  already_on_live_tier_rank: null,
  intended_link_action: null,
};

type ServerState = {
  matchStatus: number;
  matchBody: Record<string, unknown>;
  processingPhase: string | null;
  matchCalls: number;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function stubFetch(server: ServerState) {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith(`/batches/${BATCH_ID}/match`)) {
      server.matchCalls += 1;
      return jsonResponse(server.matchBody, server.matchStatus);
    }
    if (url.includes(`/batches/${BATCH_ID}/rows?`)) {
      return jsonResponse({
        ok: true,
        rows: [needsReviewRow],
        total: 1,
        page: 1,
        pageSize: 500,
        summary: persistedSummary,
      });
    }
    if (url.endsWith(`/batches/${BATCH_ID}`)) {
      return jsonResponse({
        ok: true,
        batch: { ...batch, processing_phase: server.processingPhase },
        summary: persistedSummary,
        headers: [],
      });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  }) as typeof fetch;
}

function findButton(container: HTMLElement, label: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll("button")).find((candidate) =>
    candidate.textContent?.includes(label),
  );
  assert.ok(button, `Expected a button containing "${label}".`);
  return button as HTMLButtonElement;
}

async function waitFor(predicate: () => boolean, message: string) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (predicate()) return;
    await act(async () => {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      });
    });
  }
  assert.fail(message);
}

describe("ReviewQueueStep while matching is still running", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    container?.remove();
    container = null;
    root = null;
  });

  function mount() {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root?.render(
        <ImportFlowProgressProvider>
          <SponsorImportWizardProvider
            value={{
              batch,
              goToStep: () => {},
              openDraftStep: () => {},
              updateBatch: () => {},
              markImportToDraftComplete: () => {},
            }}
          >
            <ReviewQueueStep initialSummary={staleSummary} />
          </SponsorImportWizardProvider>
        </ImportFlowProgressProvider>,
      );
    });
    return container;
  }

  it("shows persisted rows but pauses review actions when /match returns 409", async () => {
    const server: ServerState = {
      matchStatus: 409,
      matchBody: {
        ok: false,
        error: "Matching is already in progress.",
        details: { processing_phase: "matching" },
      },
      processingPhase: "matching",
      matchCalls: 0,
    };
    stubFetch(server);
    const view = mount();

    await waitFor(
      () => view.textContent?.includes("Company matching is still running") ?? false,
      "Expected the matching-in-progress notice",
    );

    assert.ok(!view.textContent?.includes("Matching companies…"), "spinner should be cleared");
    assert.ok(view.textContent?.includes("Auto-ready: 1"), "persisted summary should be shown");
    assert.equal(findButton(view, "Bulk accept domain matches").disabled, true);
    assert.equal(findButton(view, "Select all matching filter").disabled, true);
    assert.equal(findButton(view, "Decide").disabled, true);
    assert.equal(findButton(view, "Import to draft").disabled, true);
  });

  it("unlocks review after Check again once the server reports matching complete", async () => {
    const server: ServerState = {
      matchStatus: 409,
      matchBody: { ok: false, error: "Matching is already in progress." },
      processingPhase: "matching",
      matchCalls: 0,
    };
    stubFetch(server);
    const view = mount();

    await waitFor(
      () => view.textContent?.includes("Company matching is still running") ?? false,
      "Expected the matching-in-progress notice",
    );

    server.matchStatus = 200;
    server.matchBody = { ok: true, matched_count: 2, skipped: true };
    server.processingPhase = null;

    await act(async () => {
      findButton(view, "Check again").click();
    });

    await waitFor(
      () => !(view.textContent?.includes("Company matching is still running") ?? true),
      "Expected the notice to clear after matching completed",
    );

    assert.equal(server.matchCalls, 2);
    assert.equal(findButton(view, "Bulk accept domain matches").disabled, false);
    assert.equal(findButton(view, "Decide").disabled, false);
  });
});
