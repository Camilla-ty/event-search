import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildEventExplorerTopicUrl,
  buildTopicHubPath,
} from "@/src/lib/routes/explorerUrls";

describe("buildTopicHubPath", () => {
  it("builds a topic hub path from slug", () => {
    assert.equal(buildTopicHubPath("crypto"), "/topics/crypto");
    assert.equal(buildTopicHubPath(" web3 "), "/topics/web3");
    assert.equal(buildTopicHubPath(""), null);
  });
});

describe("buildEventExplorerTopicUrl", () => {
  it("builds an events explorer URL with topic param", () => {
    assert.equal(buildEventExplorerTopicUrl("crypto"), "/events?topic=crypto");
    assert.equal(buildEventExplorerTopicUrl(" web3 "), "/events?topic=web3");
    assert.equal(buildEventExplorerTopicUrl(""), "/events");
  });
});
