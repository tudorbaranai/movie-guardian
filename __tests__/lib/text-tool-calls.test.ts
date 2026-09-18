// @vitest-environment node
// Tests for the shim that copes with models writing their tool calls as text
// instead of sending them as data (lib/text-tool-calls.ts).
//
// The example markup here is real: it's what the free-tier model actually put
// on screen before this existed.
import { describe, expect, it } from "vitest";
import { ToolCallTextFilter, parseTextToolCalls } from "@/lib/text-tool-calls";

const REAL_OUTPUT = `<tool_call>search_movies
<arg_key>query</arg_key>
<arg_value>Spider-Man No Way Home</arg_value>
</tool_call>
<tool_call>search_movies
<arg_key>query</arg_key>
<arg_value>Shang-Chi and the Legend of the Ten Rings</arg_value>
</tool_call>`;

/** Push a whole string through the filter one character at a time. */
function streamThrough(text: string, chunkSize = 1) {
  const filter = new ToolCallTextFilter();
  let shown = "";
  for (let at = 0; at < text.length; at += chunkSize) {
    shown += filter.push(text.slice(at, at + chunkSize));
  }
  const { text: tail, toolCallText } = filter.finish();
  return { shown: shown + tail, toolCallText };
}

describe("ToolCallTextFilter", () => {
  it("lets an ordinary answer through untouched", () => {
    const answer = "Try [Heat (1995)](/movie/949) — patient and beautiful.";

    expect(streamThrough(answer).shown).toBe(answer);
    expect(streamThrough(answer).toolCallText).toBe("");
  });

  it("shows none of the markup, however the chunks fall", () => {
    // One character at a time is the worst case: every partial marker appears.
    for (const chunkSize of [1, 3, 7, 40, 1000]) {
      const { shown, toolCallText } = streamThrough(REAL_OUTPUT, chunkSize);

      expect(shown).toBe("");
      expect(shown).not.toContain("<");
      expect(toolCallText).toContain("search_movies");
    }
  });

  it("shows the real answer written before a tool call, but not the call", () => {
    const { shown, toolCallText } = streamThrough(
      `Let me check.<tool_call>search_movies
<arg_key>query</arg_key>
<arg_value>Heat</arg_value>
</tool_call>`,
    );

    expect(shown).toBe("Let me check.");
    expect(toolCallText).toContain("Heat");
  });

  it("releases text that only looked like the start of a marker", () => {
    // A reader should still see this; it is not a tool call.
    const answer = "Films with <tool in the title are rare.";

    expect(streamThrough(answer).shown).toBe(answer);
  });

  it("never emits a partial marker mid-stream", () => {
    const filter = new ToolCallTextFilter();

    // Half the marker arrives; nothing containing "<" may be shown yet.
    expect(filter.push("Sure thing. <tool_c")).toBe("Sure thing. ");
    expect(filter.push("all>search_movies")).toBe("");
  });
});

describe("parseTextToolCalls", () => {
  it("finds every call in the model's real output", () => {
    expect(parseTextToolCalls(REAL_OUTPUT)).toEqual([
      { name: "search_movies", args: '{"query":"Spider-Man No Way Home"}' },
      {
        name: "search_movies",
        args: '{"query":"Shang-Chi and the Legend of the Ten Rings"}',
      },
    ]);
  });

  it("reads the JSON style some other models use", () => {
    const text =
      '<tool_call>{"name": "get_movie", "arguments": {"id": 949}}</tool_call>';

    expect(parseTextToolCalls(text)).toEqual([
      { name: "get_movie", args: '{"id":949}' },
    ]);
  });

  it("finds nothing in an ordinary answer", () => {
    expect(parseTextToolCalls("Try Heat (1995), it's great.")).toEqual([]);
  });

  it("drops a call it can't read rather than inventing arguments", () => {
    expect(parseTextToolCalls("<tool_call>{oh dear</tool_call>")).toEqual([]);
  });
});
