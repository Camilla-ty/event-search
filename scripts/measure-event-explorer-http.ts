/**
 * HTTP + filter-key analysis for Event Explorer flows.
 * Run while dev server is up with EVENT_EXPLORER_TIMING=1.
 *
 * npx tsx scripts/measure-event-explorer-http.ts
 */
import { performance } from "node:perf_hooks";

import {
  buildEventExplorerFilterKey,
  parseEventExplorerFiltersFromSearchParams,
} from "@/src/features/events/lib/eventExplorerQuery";

const BASE = process.env.EVENT_EXPLORER_BASE_URL ?? "http://localhost:3000";

const URLS = [
  { id: "A", path: "/events?topic=crypto-blockchain" },
  { id: "B", path: "/events?topic=crypto-blockchain&topic=ai" },
  { id: "C", path: "/events?topic=crypto-blockchain" },
  { id: "D", path: "/events" },
  { id: "E", path: "/events?topic=crypto-blockchain" },
  { id: "B-alt-order", path: "/events?topic=ai&topic=crypto-blockchain" },
];

async function measureUrl(id: string, path: string) {
  const url = `${BASE}${path}`;
  const start = performance.now();
  const response = await fetch(url, {
    headers: { Accept: "text/html" },
    redirect: "follow",
  });
  const body = await response.text();
  const total = performance.now() - start;
  return {
    id,
    path,
    status: response.status,
    totalMs: total,
    bytes: body.length,
  };
}

function analyzeFilterKeys() {
  const cryptoAi = parseEventExplorerFiltersFromSearchParams(
    new URLSearchParams("topic=crypto-blockchain&topic=ai"),
  );
  const aiCrypto = parseEventExplorerFiltersFromSearchParams(
    new URLSearchParams("topic=ai&topic=crypto-blockchain"),
  );

  const keyCryptoAi = buildEventExplorerFilterKey(cryptoAi);
  const keyAiCrypto = buildEventExplorerFilterKey(aiCrypto);

  return {
    cryptoAiTopics: cryptoAi.topics,
    aiCryptoTopics: aiCrypto.topics,
    keyCryptoAi,
    keyAiCrypto,
    keysEqual: keyCryptoAi === keyAiCrypto,
  };
}

async function main() {
  console.log(`HTTP benchmark against ${BASE}\n`);

  const keyAnalysis = analyzeFilterKeys();
  console.log("Filter key order analysis:");
  console.log(JSON.stringify(keyAnalysis, null, 2));
  console.log("");

  for (const entry of URLS) {
    const result = await measureUrl(entry.id, entry.path);
    console.log(
      `Flow ${result.id}: ${result.path} -> ${result.status} ${result.totalMs.toFixed(1)}ms (${result.bytes} bytes)`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
