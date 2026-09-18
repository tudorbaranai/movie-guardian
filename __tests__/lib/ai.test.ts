// @vitest-environment node
// Tests for the AI settings read out of the environment (lib/ai.ts).
//
// These matter more than they look. The chat route's own tests MOCK this whole
// module — they hand it fixed values and check the route behaves. That means
// the real code here, which decides the model and whether tool calling runs,
// never executes in those tests at all. This file is the only place it does.
//
// The values are read once when the module is first loaded, so each test has to
// set the environment and then load a FRESH copy — hence `vi.resetModules()`
// and the dynamic `import` instead of a normal one at the top.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Load a fresh copy of lib/ai.ts with these environment values set. */
async function loadWith(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return import("@/lib/ai");
}

const AI_KEYS = [
  "AI_MODEL",
  "AI_FALLBACK_MODELS",
  "AI_TOOL_ROUNDS",
  "AI_REASONING_EFFORT",
  "AI_GATEWAY_API_KEY",
];

let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = Object.fromEntries(AI_KEYS.map((key) => [key, process.env[key]]));
  for (const key of AI_KEYS) delete process.env[key];
});

afterEach(() => {
  // Put the real environment back, or later test files inherit ours.
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  vi.restoreAllMocks();
});

describe("AI_TOOL_ROUNDS — the one-request-per-question guarantee", () => {
  it("is 0 by default, so no tools are offered and one question costs one request", async () => {
    // If this ever defaults to anything above 0, every question silently costs
    // three requests again and the free allowance is gone after one.
    expect((await loadWith({})).AI_TOOL_ROUNDS).toBe(0);
  });

  it("can be turned up for an account with credits", async () => {
    expect((await loadWith({ AI_TOOL_ROUNDS: "2" })).AI_TOOL_ROUNDS).toBe(2);
  });

  it("treats a nonsense value as off, never as NaN", async () => {
    // Number("abc") is NaN, and NaN >= 0 is false — which would make EVERY
    // round look like a tool round and loop forever.
    expect((await loadWith({ AI_TOOL_ROUNDS: "abc" })).AI_TOOL_ROUNDS).toBe(0);
  });
});

describe("AI_REASONING_EFFORT — the setting that once killed the chat", () => {
  it("is unset by default, so nothing is sent", async () => {
    // Not every model has an "effort" setting. Sending one to a model that
    // doesn't take it is a 400 and a dead answer, so silence is the safe default.
    expect((await loadWith({})).AI_REASONING_EFFORT).toBeNull();
  });

  it("passes through a level the API actually accepts", async () => {
    expect(
      (await loadWith({ AI_REASONING_EFFORT: "low" })).AI_REASONING_EFFORT,
    ).toBe("low");
    expect(
      (await loadWith({ AI_REASONING_EFFORT: "  max  " })).AI_REASONING_EFFORT,
    ).toBe("max");
  });

  it("ignores a level that isn't real, and says why", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { AI_REASONING_EFFORT } = await loadWith({
      AI_REASONING_EFFORT: "fast",
    });

    // Dropping it beats sending it: a typo in .env.local should cost you a
    // setting, not every answer.
    expect(AI_REASONING_EFFORT).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("fast"));
  });
});

describe("AI_FALLBACK_MODELS", () => {
  it("defaults to other free models, for when one is down", async () => {
    const { AI_FALLBACK_MODELS } = await loadWith({});

    expect(AI_FALLBACK_MODELS.length).toBeGreaterThan(0);
    expect(AI_FALLBACK_MODELS).not.toContain("");
  });

  it("splits a list and tidies the spaces around it", async () => {
    const { AI_FALLBACK_MODELS } = await loadWith({
      AI_FALLBACK_MODELS: " a/one , b/two ",
    });

    expect(AI_FALLBACK_MODELS).toEqual(["a/one", "b/two"]);
  });

  it("treats an empty setting as 'no fallbacks', not as one blank model", async () => {
    // A blank entry would be sent to the gateway as a model name.
    expect(
      (await loadWith({ AI_FALLBACK_MODELS: "" })).AI_FALLBACK_MODELS,
    ).toEqual([]);
    expect(
      (await loadWith({ AI_FALLBACK_MODELS: " , " })).AI_FALLBACK_MODELS,
    ).toEqual([]);
  });
});

describe("AI_MODEL and the key", () => {
  it("defaults to a model that costs nothing", async () => {
    const { AI_MODEL } = await loadWith({});

    // The site has to work on an account that has never bought credits.
    expect(AI_MODEL).toContain("free");
  });

  it("can be pointed at any model", async () => {
    expect((await loadWith({ AI_MODEL: "openai/gpt-5.6-luna" })).AI_MODEL).toBe(
      "openai/gpt-5.6-luna",
    );
  });

  it("knows whether the gateway key is present", async () => {
    expect((await loadWith({})).aiIsConfigured()).toBe(false);
    expect(
      (await loadWith({ AI_GATEWAY_API_KEY: "vck_test" })).aiIsConfigured(),
    ).toBe(true);
  });
});
