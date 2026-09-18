// @vitest-environment node
// Tests for reading the "who is this?" header (lib/supabase-server.ts).
//
// `bearerToken` is a door lock. The chat route hands whatever it returns to
// Supabase, and Supabase then decides whose rows may be read — so if this
// function accepts something it shouldn't, the route acts on a header we never
// meant to trust.
//
// The chat route's own tests already cover the two ordinary cases (a proper
// header, and no header at all). These are the malformed shapes those never
// send, which is exactly where hand-written parsing goes wrong.
import { describe, expect, it } from "vitest";
import { bearerToken } from "@/lib/supabase-server";

/** A request carrying whatever Authorization header we want to try. */
function requestWith(header: string | null) {
  return new Request("http://localhost/api/chat", {
    headers: header === null ? {} : { Authorization: header },
  });
}

describe("bearerToken", () => {
  it("reads the token out of a normal header", () => {
    expect(bearerToken(requestWith("Bearer abc123"))).toBe("abc123");
  });

  it("accepts the scheme in any case", () => {
    // Deliberate: HTTP treats the scheme as case-insensitive, and Supabase
    // clients in the wild send both spellings.
    expect(bearerToken(requestWith("bearer abc123"))).toBe("abc123");
    expect(bearerToken(requestWith("BEARER abc123"))).toBe("abc123");
  });

  it("returns nothing when there is no header at all", () => {
    expect(bearerToken(requestWith(null))).toBeNull();
  });

  it("refuses a different authentication scheme", () => {
    // Basic auth carries a password, not a Supabase session. Accepting it
    // would mean handing Supabase something it can't verify.
    expect(bearerToken(requestWith("Basic abc123"))).toBeNull();
    expect(bearerToken(requestWith("Token abc123"))).toBeNull();
  });

  it("refuses a scheme with no token after it", () => {
    expect(bearerToken(requestWith("Bearer"))).toBeNull();
    expect(bearerToken(requestWith("Bearer "))).toBeNull();
  });

  it("refuses a bare token with no scheme", () => {
    expect(bearerToken(requestWith("abc123"))).toBeNull();
  });

  it("refuses an empty token hidden by a double space", () => {
    // "Bearer  abc" splits to ["Bearer", "", "abc"] — the token we'd read is
    // the empty string, so this must be rejected rather than passed on.
    expect(bearerToken(requestWith("Bearer  abc123"))).toBeNull();
  });
});
