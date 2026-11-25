import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import type { ExhibitorImportBatch, RowSummary } from "../../client/types";
import { MATERIALIZE_COMPANIES_DEFAULT_CHUNK } from "../../server/materializeCompanies";
import { ExhibitorImportWizardProvider } from "../ExhibitorImportWizardContext";
import { ImportFlowProgressProvider } from "../ImportFlowProgress";
import { ReviewQueueStep } from "./ReviewQueueStep";

const BATCH_ID = "7fc09d71-0000-4000-8000-0000000000e6";

const batch: ExhibitorImportBatch = {
  id: BATCH_ID,
  event_edition_id: "edition-1",
  status: "review",
  processing_phase: null,
  source_filename: "exhibitors.csv",
  source_file_storage_path: "path/exhibitors.csv",
  source_file_format: "csv",
  source_sheet_name: null,
  source_row_count: 16,
  column_mapping: { company_name: "Company", website: "Website", tier_rank: "Tier", tier_label: "Label" },
  created_at: "2026-11-25T03:06:51.000Z",
  updated_at: "2026-11-25T03:06:51.000Z",
};

const readySummary: RowSummary = {
  total: 16,
  needs_review: 0,
  auto_ready: 0,
  resolved: 16,
  excluded: 0,
  blocking_validation_count: 0,
  pending_duplicate_count: 0,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
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

describe("ReviewQueueStep company materialization request", () => {
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

  it("sends limit 15 with the cursor and leaves draft-link requests unchanged", async () => {
    const companyBodies: Array<Record<string, unknown>> = [];
    const draftBodies: Array<Record<string, unknown>> = [];
    let companyCalls = 0;
    let openedDraft = false;

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith(`/batches/${BATCH_ID}/match`)) {
        return jsonResponse({ ok: true, matched_count: 16, skipped: true });
      }
      if (url.includes(`/batches/${BATCH_ID}/rows?`)) {
        return jsonResponse({
          ok: true,
          rows: [],
          total: 16,
          page: 1,
          pageSize: 500,
          summary: readySummary,
        });
      }
      if (url.endsWith(`/batches/${BATCH_ID}/materialize-companies/chunk`)) {
        companyCalls += 1;
        companyBodies.push(JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>);
        if (companyCalls === 1) {
          return jsonResponse({
            ok: true,
            result: {
              examined_count: 15,
              skipped_count: 0,
              materialized_count: 15,
              companies_created: 15,
              total_resolved_rows: 16,
              rows_with_company_id: 15,
              duplicate_name_review_count: 0,
              done: false,
              next_cursor: 101,
            },
          });
        }
        return jsonResponse({
          ok: true,
          result: {
            examined_count: 1,
            skipped_count: 0,
            materialized_count: 1,
            companies_created: 1,
            total_resolved_rows: 16,
            rows_with_company_id: 16,
            duplicate_name_review_count: 0,
            done: true,
            next_cursor: null,
          },
        });
      }
      if (url.endsWith(`/batches/${BATCH_ID}/materialize-draft-links/chunk`)) {
        draftBodies.push(JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>);
        return jsonResponse({
          ok: true,
          result: {
            examined_count: 16,
            skipped_count: 0,
            links_created: 16,
            links_updated: 0,
            rows_linked: 16,
            total_resolved_rows: 16,
            rows_with_draft_link: 16,
            done: true,
            next_cursor: null,
          },
        });
      }
      if (url.endsWith(`/batches/${BATCH_ID}/import-to-draft`)) {
        return jsonResponse({ ok: true, result: { linked: 16 } });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root?.render(
        <ImportFlowProgressProvider>
          <ExhibitorImportWizardProvider
            value={{
              batch,
              goToStep: () => {},
              openDraftStep: () => {
                openedDraft = true;
              },
              updateBatch: () => {},
              markImportToDraftComplete: () => {},
            }}
          >
            <ReviewQueueStep initialSummary={readySummary} />
          </ExhibitorImportWizardProvider>
        </ImportFlowProgressProvider>,
      );
    });

    await waitFor(
      () => findButton(container!, "Import to draft").disabled === false,
      "Expected Import to draft to become available",
    );

    await act(async () => {
      findButton(container!, "Import to draft").click();
    });

    await waitFor(() => openedDraft, "Expected the draft step to open after import");

    assert.equal(MATERIALIZE_COMPANIES_DEFAULT_CHUNK, 15);
    assert.equal(companyBodies.length, 2);
    assert.deepEqual(companyBodies[0], { limit: 15 });
    assert.deepEqual(companyBodies[1], { cursor: 101, limit: 15 });
    assert.deepEqual(draftBodies, [{}]);
  });
});
