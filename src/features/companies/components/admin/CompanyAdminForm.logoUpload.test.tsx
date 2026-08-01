import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import assert from "node:assert/strict";
import { afterEach, before, describe, it, mock } from "node:test";
import { act, type ComponentType } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";

type CompanyAdminFormComponent = ComponentType<{
  mode: "create" | "edit";
  companyId?: string;
  cities: [];
  initial: {
    name: string;
    website: string;
    slug: string;
    city_id: string;
    logo_url: string;
    aliases: string[];
  };
  initialLogoMetadata?: {
    logo_url: string;
    logo_source: string | null;
    logo_status: string | null;
    logo_fetched_at: string | null;
  };
}>;

const COMPANY_ID = "11111111-1111-1111-1111-111111111111";
const EXISTING_LOGO_URL = `companies/${COMPANY_ID}/logo.png`;
const EXISTING_FETCHED_AT = "2026-01-08T07:32:24.000Z";

const initialValues = {
  name: "Monetary Authority of Singapore",
  website: "https://www.mas.gov.sg",
  slug: "monetary-authority-of-singapore",
  city_id: "",
  logo_url: EXISTING_LOGO_URL,
  aliases: [] as string[],
};

const initialLogoMetadata = {
  logo_url: EXISTING_LOGO_URL,
  logo_source: "storage",
  logo_status: "error",
  logo_fetched_at: EXISTING_FETCHED_AT,
};

function findButton(container: HTMLElement, label: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll("button")).find((candidate) =>
    candidate.textContent?.includes(label),
  );
  assert.ok(button, `Expected a button containing "${label}".`);
  return button as HTMLButtonElement;
}

function makePngFile(name = "logo.png"): File {
  const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 1]);
  return new File([bytes], name, { type: "image/png" });
}

async function selectFile(input: HTMLInputElement, file: File) {
  const transfer = new DataTransfer();
  transfer.items.add(file);
  await act(async () => {
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function flushClientUpdates() {
  await act(async () => {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
  });
}

describe("CompanyAdminForm logo file upload", () => {
  let CompanyAdminForm: CompanyAdminFormComponent;
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  const originalFetch = globalThis.fetch;

  before(async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    mock.module("next/navigation", {
      namedExports: {
        useRouter: () => ({
          push: () => {},
          refresh: () => {},
          replace: () => {},
          prefetch: () => {},
          back: () => {},
          forward: () => {},
        }),
      },
    });
    ({ CompanyAdminForm } = (await import(
      "@/src/features/companies/components/admin/CompanyAdminForm"
    )) as { CompanyAdminForm: CompanyAdminFormComponent });
  });

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
        <CompanyAdminForm
          mode="edit"
          companyId={COMPANY_ID}
          cities={[]}
          initial={initialValues}
          initialLogoMetadata={initialLogoMetadata}
        />,
      );
    });
  }

  it("displays the local upload control next to Logo URL on edit", () => {
    const html = renderToStaticMarkup(
      <CompanyAdminForm
        mode="edit"
        companyId={COMPANY_ID}
        cities={[]}
        initial={initialValues}
        initialLogoMetadata={initialLogoMetadata}
      />,
    );

    assert.match(html, />Logo URL</);
    assert.match(html, />Upload logo file</);
    assert.match(html, /type="file"/);
    assert.match(html, />Upload logo</);
    assert.match(html, /Import from URL/);
    assert.match(html, /Choose a PNG, JPG, or WebP image up to 2 MB/);
    assert.match(html, /Logo preview/);
  });

  it("keeps Logo URL field and does not show upload controls on create", () => {
    const html = renderToStaticMarkup(
      <CompanyAdminForm
        mode="create"
        cities={[]}
        initial={{
          name: "",
          website: "",
          slug: "",
          city_id: "",
          logo_url: "",
          aliases: [],
        }}
      />,
    );

    assert.doesNotMatch(html, />Upload logo file</);
    assert.doesNotMatch(html, /type="file"/);
    assert.doesNotMatch(html, />Logo URL</);
  });

  it("calls the existing Company logo endpoint and refreshes preview on success", async () => {
    mount();
    assert.ok(container);

    const nextLogoUrl = `companies/${COMPANY_ID}/logo.webp`;
    const nextFetchedAt = "2026-08-01T08:00:00.000Z";
    let seenUrl = "";
    let seenMethod = "";
    let seenHasFile = false;

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      seenUrl = String(input);
      seenMethod = init?.method ?? "GET";
      const body = init?.body;
      if (body instanceof FormData) {
        seenHasFile = body.get("file") instanceof File;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          company: {
            id: COMPANY_ID,
            logo_url: nextLogoUrl,
            logo_source: "manual",
            logo_status: "ok",
            logo_fetched_at: nextFetchedAt,
          },
        }),
      } as Response;
    }) as typeof fetch;

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement | null;
    assert.ok(fileInput);
    await selectFile(fileInput, makePngFile());

    const uploadButton = findButton(container, "Upload logo");
    assert.equal(uploadButton.disabled, false);

    await act(async () => {
      uploadButton.click();
    });
    await flushClientUpdates();

    assert.equal(seenUrl, `/api/admin/companies/${COMPANY_ID}/logo`);
    assert.equal(seenMethod, "POST");
    assert.equal(seenHasFile, true);
    assert.match(container.textContent ?? "", /Logo uploaded/);
    assert.match(container.textContent ?? "", /Source\s*manual/i);
    assert.match(container.textContent ?? "", /Status\s*ok/i);

    const previewImg = container.querySelector(
      'img[alt="Company logo preview"]',
    ) as HTMLImageElement | null;
    assert.ok(previewImg);
    assert.match(previewImg.getAttribute("src") ?? "", /logo\.webp/);
    assert.ok(
      (previewImg.getAttribute("src") ?? "").includes(encodeURIComponent(nextFetchedAt)),
    );
  });

  it("shows an error and preserves the current preview when upload fails", async () => {
    mount();
    assert.ok(container);

    globalThis.fetch = (async () =>
      ({
        ok: false,
        status: 500,
        json: async () => ({ ok: false, error: "Logo upload failed." }),
      }) as Response) as typeof fetch;

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement | null;
    assert.ok(fileInput);
    await selectFile(fileInput, makePngFile());

    await act(async () => {
      findButton(container!, "Upload logo").click();
    });
    await flushClientUpdates();

    assert.match(container.textContent ?? "", /Logo upload failed/);
    assert.match(container.textContent ?? "", /Source\s*storage/i);
    assert.match(container.textContent ?? "", /Status\s*error/i);

    const previewImg = container.querySelector(
      'img[alt="Company logo preview"]',
    ) as HTMLImageElement | null;
    assert.ok(previewImg);
    assert.match(previewImg.getAttribute("src") ?? "", /logo\.png/);
    assert.ok(
      (previewImg.getAttribute("src") ?? "").includes(encodeURIComponent(EXISTING_FETCHED_AT)),
    );
  });

  it("disables upload controls while uploading", async () => {
    mount();
    assert.ok(container);

    let resolveFetch: ((value: Response) => void) | null = null;
    globalThis.fetch = (() =>
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      })) as typeof fetch;

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement | null;
    assert.ok(fileInput);
    await selectFile(fileInput, makePngFile());

    const uploadButton = findButton(container, "Upload logo");
    await act(async () => {
      uploadButton.click();
    });
    await flushClientUpdates();

    assert.match(container.textContent ?? "", /Uploading…/);
    assert.equal(findButton(container, "Uploading…").disabled, true);
    assert.equal(
      (container.querySelector('input[type="file"]') as HTMLInputElement).disabled,
      true,
    );
    assert.equal(findButton(container, "Save changes").disabled, true);

    await act(async () => {
      resolveFetch?.({
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          company: {
            id: COMPANY_ID,
            logo_url: EXISTING_LOGO_URL,
            logo_source: "manual",
            logo_status: "ok",
            logo_fetched_at: "2026-08-01T09:00:00.000Z",
          },
        }),
      } as Response);
    });
    await flushClientUpdates();

    assert.match(container.textContent ?? "", /Logo uploaded/);
    assert.equal(findButton(container, "Save changes").disabled, false);
  });

  it("preserves Logo URL save workflow via PATCH company endpoint", async () => {
    mount();
    assert.ok(container);

    let patchUrl = "";
    const patchState: { body: Record<string, unknown> | null } = { body: null };

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      patchUrl = String(input);
      patchState.body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          company: {
            id: COMPANY_ID,
            logo_url: EXISTING_LOGO_URL,
            logo_source: "manual",
            logo_status: "ok",
            logo_fetched_at: EXISTING_FETCHED_AT,
            aliases: [],
          },
          warnings: [],
        }),
      } as Response;
    }) as typeof fetch;

    const logoUrlInput = Array.from(container.querySelectorAll("input")).find(
      (input) => input.getAttribute("placeholder") === "https://…",
    ) as HTMLInputElement | null;
    assert.ok(logoUrlInput);
    assert.equal(logoUrlInput.value, EXISTING_LOGO_URL);
    assert.match(container.textContent ?? "", /Import from URL/);

    await act(async () => {
      findButton(container!, "Save changes").click();
    });
    await flushClientUpdates();

    assert.equal(patchUrl, `/api/admin/companies/${COMPANY_ID}`);
    assert.equal(patchState.body?.logo_url, EXISTING_LOGO_URL);
    assert.match(container.textContent ?? "", /Company updated successfully/);
  });
});
