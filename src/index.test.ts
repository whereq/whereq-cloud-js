import { describe, it, expect, vi } from "vitest";
import { Whereq, WhereqError } from "./index";

function mockFetch(status: number, body: unknown) {
  return vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit) =>
      ({
        ok: status < 400,
        status,
        statusText: "",
        json: async () => body,
        text: async () => JSON.stringify(body),
      }) as unknown as Response,
  );
}

describe("Whereq", () => {
  it("builds params, drops undefined, sends the key", async () => {
    const f = mockFetch(200, { ok: true });
    const wq = new Whereq({ apiKey: "wq_test", fetch: f });
    const out = await wq.prices({ domain: "rent", region: undefined, bedrooms: 2 });
    expect(out).toEqual({ ok: true });
    const url = String(f.mock.calls[0][0]);
    const init = f.mock.calls[0][1] as RequestInit;
    expect(url).toContain("domain=rent");
    expect(url).toContain("bedrooms=2");
    expect(url).not.toContain("region");
    expect((init.headers as Record<string, string>)["X-API-Key"]).toBe("wq_test");
  });

  it("throws WhereqError on non-2xx", async () => {
    const wq = new Whereq({ fetch: mockFetch(402, { detail: "quota reached" }) });
    await expect(wq.prices({ domain: "rent" })).rejects.toBeInstanceOf(WhereqError);
  });

  it("encodes the cost-of-living places param", async () => {
    const f = mockFetch(200, { places: [] });
    const wq = new Whereq({ fetch: f });
    await wq.costOfLiving("us:California");
    const url = String(f.mock.calls[0][0]);
    expect(url).toContain("/v1/cost-of-living");
    expect(url).toContain("places=us%3ACalifornia");
  });
});
