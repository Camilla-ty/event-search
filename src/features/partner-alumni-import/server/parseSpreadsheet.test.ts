import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

import * as XLSX from "xlsx";

import { guessColumnMapping, parseWithColumnMapping, resolveUploadColumnMapping } from "./parseSpreadsheet";

function buildWorkbookBuffer(rows: unknown[][]): ArrayBuffer {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Partner Alumni");
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

function textBuffer(text: string): ArrayBuffer {
  const buf = Buffer.from(text, "utf8");
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

const NFT_NYC_GOLDEN_CSV_PATH =
  process.env.NFT_NYC_GOLDEN_CSV ??
  "/Users/hwangcamilla/Downloads/NFT.NYC 2025 partners_sponsors - Sheet3.csv";

const NFT_NYC_HEADERLESS_SAMPLE = `Amazon Web Services (AWS),https://aws.amazon.com/,1
Animoca Brands,https://www.animocabrands.com/,2
Brave,https://brave.com/,3
MoonPay,https://www.moonpay.com/,12
OpenSea,https://opensea.io/,14
`;

describe("partner alumni parseSpreadsheet", () => {
  it("skips Partner Alumni title row and maps NFT NYC-style headers", () => {
    const buffer = buildWorkbookBuffer([
      ["Partner Alumni", ""],
      ["#", "Company Name", "Website/Domain"],
      ["1", "MoonPay", "https://www.moonpay.com"],
      ["2", "OpenSea", "https://opensea.io"],
    ]);

    const mapping = guessColumnMapping(buffer);
    assert.ok(mapping);
    assert.equal(mapping.company_name, "Company Name");
    assert.equal(mapping.website, "Website/Domain");
    assert.equal(mapping.display_order, "#");
    assert.equal(mapping.header_row_index, 1);

    const parsed = parseWithColumnMapping(buffer, mapping);
    assert.equal(parsed.rows.length, 2);
    assert.equal(parsed.rows[0]?.rawCompanyName, "MoonPay");
    assert.equal(parsed.rows[0]?.rawWebsite, "https://www.moonpay.com");
    assert.equal(parsed.rows[0]?.rawDisplayOrder, "1");
    assert.equal(parsed.rows[0]?.excelRowNumber, 3);
  });

  it("infers positional mapping for headerless NFT NYC golden CSV", () => {
    const buffer = textBuffer(NFT_NYC_HEADERLESS_SAMPLE);

    const mapping = guessColumnMapping(buffer);
    assert.ok(mapping);
    assert.equal(mapping.company_name, "A");
    assert.equal(mapping.website, "B");
    assert.equal(mapping.display_order, "C");
    assert.equal(mapping.header_row_index, -1);

    const parsed = parseWithColumnMapping(buffer, mapping);
    assert.equal(parsed.rows.length, 5);
    assert.equal(parsed.rows[0]?.rawCompanyName, "Amazon Web Services (AWS)");
    assert.equal(parsed.rows[0]?.rawWebsite, "https://aws.amazon.com/");
    assert.equal(parsed.rows[0]?.rawDisplayOrder, "1");
    assert.equal(parsed.rows[3]?.rawCompanyName, "MoonPay");
  });

  if (existsSync(NFT_NYC_GOLDEN_CSV_PATH)) {
    it("parses the full NFT NYC golden QA CSV when available locally", () => {
      const buffer = textBuffer(readFileSync(NFT_NYC_GOLDEN_CSV_PATH, "utf8"));
      const mapping = guessColumnMapping(buffer);
      assert.ok(mapping);

      const parsed = parseWithColumnMapping(buffer, mapping);
      assert.equal(parsed.rows.length, 461);
      assert.equal(parsed.rows[11]?.rawCompanyName, "MoonPay");
      assert.equal(parsed.rows[19]?.rawCompanyName, "SONY Electronics");
    });
  }

  it("falls back to positional when a data row matches a name header alias", () => {
    const buffer = textBuffer(`Partner,https://partner.example,1
Acme Corp,https://acme.com,2
`);

    const mapping = guessColumnMapping(buffer);
    assert.ok(mapping);
    assert.equal(mapping.company_name, "A");
    assert.equal(mapping.website, "B");
    assert.equal(mapping.header_row_index, -1);

    const parsed = parseWithColumnMapping(buffer, mapping);
    assert.equal(parsed.rows.length, 2);
    assert.equal(parsed.rows[0]?.rawCompanyName, "Partner");
  });

  it("resolveUploadColumnMapping never returns null for headerless CSV", () => {
    const buffer = textBuffer(NFT_NYC_HEADERLESS_SAMPLE);
    const mapping = resolveUploadColumnMapping(buffer);
    assert.equal(mapping.header_row_index, -1);
    assert.equal(mapping.company_name, "A");
    assert.equal(mapping.website, "B");
    assert.equal(mapping.display_order, "C");
  });

  it("returns null guess when website column is missing and file is not positional", () => {
    const buffer = buildWorkbookBuffer([
      ["Company Name"],
      ["MoonPay"],
    ]);
    assert.equal(guessColumnMapping(buffer), null);
    assert.ok(resolveUploadColumnMapping(buffer));
  });
});
