import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isSameOriginRequest } from "@/lib/admin/same-origin";

const HOSTED = "bookish-delight-gh--bookishdelightghh.europe-west4.hosted.app";

describe("admin same-origin guard", () => {
  it("accepts the public host behind the App Hosting proxy", () => {
    const headers = new Headers({ origin: `https://${HOSTED}`, host: "0.0.0.0:8080", "x-forwarded-host": HOSTED });
    assert.equal(isSameOriginRequest(headers), true);
  });

  it("accepts the configured custom domain", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://bookishdelightgh.com";
    const headers = new Headers({ origin: "https://bookishdelightgh.com", host: "0.0.0.0:8080" });
    assert.equal(isSameOriginRequest(headers), true);
  });

  it("accepts requests without an Origin header", () => {
    assert.equal(isSameOriginRequest(new Headers({ host: HOSTED })), true);
  });

  it("refuses another site", () => {
    const headers = new Headers({ origin: "https://evil.example", host: HOSTED, "x-forwarded-host": HOSTED });
    assert.equal(isSameOriginRequest(headers), false);
  });

  it("refuses a malformed Origin", () => {
    assert.equal(isSameOriginRequest(new Headers({ origin: "null", host: HOSTED })), false);
  });
});
