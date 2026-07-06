import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isPartnerAlumniTitleRow,
  parsePartnerAlumniBulkSpreadsheet,
} from "@/src/features/partner-alumni/lib/parsePartnerAlumniBulkSpreadsheet";

function textBuffer(text: string): ArrayBuffer {
  const buf = Buffer.from(text, "utf8");
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

function buildOfficialStyleCsv(companyCount: number): string {
  const lines = [
    "Partner Alumni,Amazon Web Services (AWS),",
    ",Company Name,Website/Domain",
  ];

  for (let index = 0; index < companyCount; index += 1) {
    const companyNumber = index + 1;
    lines.push(
      `,Company ${companyNumber},https://company-${companyNumber}.example`,
    );
  }

  return `${lines.join("\n")}\n`;
}

describe("parsePartnerAlumniBulkSpreadsheet", () => {
  it("parses CSV with header row", () => {
    const parsed = parsePartnerAlumniBulkSpreadsheet(
      textBuffer(
        "name,website,display_order\nAcme Corp,https://acme.com,1\nBeta Inc,beta.io,2\n",
      ),
    );

    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;

    assert.equal(parsed.rows.length, 2);
    assert.equal(parsed.rows[0]?.name, "Acme Corp");
    assert.equal(parsed.rows[0]?.website, "https://acme.com");
    assert.equal(parsed.rows[0]?.display_order, 1);
    assert.equal(parsed.rows[1]?.name, "Beta Inc");
  });

  it("skips blank rows", () => {
    const parsed = parsePartnerAlumniBulkSpreadsheet(
      textBuffer("name,website\nAcme Corp,https://acme.com\n,,,\n"),
    );

    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;

    assert.equal(parsed.rows.length, 1);
  });

  it("ignores a leading Partner Alumni title row and reads company columns", () => {
    const parsed = parsePartnerAlumniBulkSpreadsheet(textBuffer(buildOfficialStyleCsv(461)));

    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;

    assert.equal(parsed.rows.length, 461);
    assert.equal(parsed.rows[0]?.name, "Company 1");
    assert.equal(parsed.rows[0]?.website, "https://company-1.example");
    assert.equal(parsed.rows[460]?.name, "Company 461");
    assert.ok(!parsed.rows.some((row) => row.name.toLowerCase() === "partner alumni"));
  });

  it("does not treat the title row as a company when no header row exists", () => {
    const parsed = parsePartnerAlumniBulkSpreadsheet(
      textBuffer("Partner Alumni,Amazon Web Services (AWS)\n,Acme Corp,https://acme.com\n"),
    );

    assert.equal(parsed.ok, false);
    if (parsed.ok) return;

    assert.equal(parsed.code, "needs_column_mapping");
  });

  it("parses positional two-column CSV without headers", () => {
    const parsed = parsePartnerAlumniBulkSpreadsheet(
      textBuffer("Acme Corp,https://acme.com\nBeta Inc,beta.io\n"),
    );

    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;

    assert.equal(parsed.rows.length, 2);
    assert.equal(parsed.rows[0]?.name, "Acme Corp");
    assert.equal(parsed.rows[1]?.website, "beta.io");
  });

  it("parses with explicit column mapping", () => {
    const parsed = parsePartnerAlumniBulkSpreadsheet(
      textBuffer(
        "Partner Alumni,Amazon Web Services (AWS)\n,Company Name,Website\n,Acme Corp,https://acme.com\n",
      ),
      {
        header_row_index: 1,
        name: "B",
        website: "C",
      },
    );

    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;

    assert.equal(parsed.rows.length, 1);
    assert.equal(parsed.rows[0]?.name, "Acme Corp");
    assert.equal(parsed.rows[0]?.website, "https://acme.com");
  });
});

describe("isPartnerAlumniTitleRow", () => {
  it("detects Partner Alumni title rows", () => {
    assert.equal(isPartnerAlumniTitleRow(["Partner Alumni", "Amazon Web Services (AWS)", ""]), true);
    assert.equal(isPartnerAlumniTitleRow(["Company Name", "Website"]), false);
  });
});
