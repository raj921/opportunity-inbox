// Run: node web/lib/lead-utils.test.ts
import assert from "node:assert/strict";
import { groupReposts, leadId, type Lead } from "./lead-utils.ts";

assert.equal(leadId("https://www.linkedin.com/posts/x_y-activity-7523256979247513602-H2j8"), "li_7523256979247513602");
assert.equal(leadId("https://x.com/steve/status/1985123456789012345?s=20"), "x_1985123456789012345");
assert.equal(leadId("https://example.com/p/1"), "url_1oa81w1");

const lead = (id: string, excerpt: string, foundAt: string) => ({ id, excerpt, foundAt, postedDate: null }) as Lead;
const post = "Abdullah is looking for an experienced development partner to build a professional website and Android iOS apps for a medicine brand with payment gateway domain setup security scalable infrastructure";
const groups = groupReposts([
  lead("b", post + " Budget 20000 USD", "2026-11-03T10:00:00Z"),
  lead("a", post, "2026-11-02T10:00:00Z"),
  lead("c", "We need a corporate learning management system for onboarding our sales staff across three countries quickly", "2026-11-03T09:00:00Z"),
]);
assert.deepEqual(groups.map((g) => [g.lead.id, g.reposts.map((r) => r.id)]), [["a", ["b"]], ["c", []]]); // earliest post leads its group
console.log("ok");
