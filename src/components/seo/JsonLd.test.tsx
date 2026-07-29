import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { JsonLd, serializeJsonLd } from "@/src/components/seo/JsonLd";

describe("JsonLd", () => {
  it("renders an application/ld+json script with safe serialization", () => {
    const data = {
      "@context": "https://schema.org",
      "@type": "Event",
      name: 'Break </script><script>alert(1)</script>',
    };
    const html = renderToStaticMarkup(<JsonLd data={data} />);
    assert.match(html, /type="application\/ld\+json"/);
    assert.doesNotMatch(html, /<\/script><script>/);
    assert.match(html, /\\u003c/);

    const start = html.indexOf(">") + 1;
    const end = html.lastIndexOf("</script>");
    assert.ok(start > 0 && end > start);
    const jsonText = html.slice(start, end);
    assert.deepEqual(JSON.parse(jsonText), data);
    assert.equal(jsonText, serializeJsonLd(data));
  });

  it("renders nothing for null data", () => {
    assert.equal(renderToStaticMarkup(<JsonLd data={null} />), "");
  });
});
