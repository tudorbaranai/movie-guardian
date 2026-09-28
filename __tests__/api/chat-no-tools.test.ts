// @vitest-environment node
// The default setup: no tool calling at all.
//
// This is the configuration the site actually ships with, and the reason is
// arithmetic rather than taste — see AI_TOOL_ROUNDS in lib/ai.ts. One question
// must cost exactly one request to the model, because the free tier allows only
// a handful per window.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai", () => ({
  AI_MODEL: "test/model",
  AI_FALLBACK_MODELS: [],
  AI_REASONING_EFFORT: null,
  AI_TOOL_ROUNDS: 0, // the real default
  ai: vi.fn(),
  aiIsConfigured: vi.fn(() => true),
}));

vi.mock("@/lib/supabase-server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/supabase-server")>()),
  supabaseForToken: vi.fn(),
}));

vi.mock("@/lib/tmdb", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tmdb")>()),
  searchMovies: vi.fn(),
  // lib/chat-context.ts looks films up before the model is called.
  getMovie: vi.fn(async () => null),
}));

import { ai } from "@/lib/ai";
import { supabaseForToken } from "@/lib/supabase-server";
import { searchMovies } from "@/lib/tmdb";
import { POST } from "@/app/api/chat/route";

const client = vi.mocked(ai);
const makeSupabase = vi.mocked(supabaseForToken);
const search = vi.mocked(searchMovies);

let requestCount = 0;
let lastRequest: { tools?: unknown; messages: { content: string }[] } | null =
  null;

function fakeSupabase(userId: string) {
  return {
    auth: { getUser: async () => ({ data: { user: { id: userId } } }) },
    from: () => ({
      select: () => ({ order: async () => ({ data: [], error: null }) }),
    }),
  } as never;
}

function fakeModel(pieces: string[]) {
  return {
    chat: {
      completions: {
        async create(request: never) {
          requestCount++;
          lastRequest = request;
          return {
            async *[Symbol.asyncIterator]() {
              for (const content of pieces) {
                yield { choices: [{ delta: { content } }] };
              }
              yield { choices: [{ finish_reason: "stop", delta: {} }] };
            },
          };
        },
      },
    },
  } as never;
}

function callChat(content: string) {
  return POST(
    new Request("http://localhost/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer good-token",
      },
      body: JSON.stringify({ messages: [{ role: "user", content }] }),
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  requestCount = 0;
  lastRequest = null;
  makeSupabase.mockReturnValue(fakeSupabase(`user-${Math.random()}`));
  search.mockResolvedValue([]);
});

describe("POST /api/chat with tool calling off (the default)", () => {
  it("costs exactly one request to the model", async () => {
    client.mockReturnValue(fakeModel(["Try something calm tonight."]));

    const response = await callChat("what next?");

    expect(await response.text()).toBe("Try something calm tonight.");
    expect(requestCount).toBe(1);
    // No tool menu is sent, so there's nothing to pay for and nothing to loop on.
    expect(lastRequest?.tools).toBeUndefined();
  });

  it("tells the model it cannot look anything up, so it shouldn't guess", async () => {
    client.mockReturnValue(fakeModel(["ok"]));

    await (await callChat("hi")).text();

    const prompt = lastRequest?.messages[0]?.content ?? "";
    expect(prompt).toContain("no way to look anything up");
    expect(prompt).not.toContain("search_movies");
  });

  it("still links film titles, by resolving them itself", async () => {
    search.mockResolvedValue([
      {
        id: 949,
        title: "Heat",
        release_date: "1995-12-15",
        poster_path: null,
        backdrop_path: null,
        overview: "",
        vote_average: 7.9,
      },
    ]);
    client.mockReturnValue(fakeModel(["Try ", "**Heat (1995)**", " tonight."]));

    const response = await callChat("what next?");

    // The model wrote bold; the reader gets a link — at no cost to the model.
    expect(await response.text()).toBe(
      "Try [Heat (1995)](/movie/949) tonight.",
    );
    expect(requestCount).toBe(1);
  });
});
