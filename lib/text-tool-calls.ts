// Catching tool calls that arrive as plain text instead of as data.
//
// **The problem.** The Chat Completions API has a proper field for "I want to
// call a tool": `tool_calls`, arriving as structured data we can act on. Not
// every model uses it. Several open models — including the free ones this site
// defaults to — instead just *write* the call into their answer, like this:
//
//     <tool_call>search_movies
//     <arg_key>query</arg_key>
//     <arg_value>Spider-Man: No Way Home</arg_value>
//     </tool_call>
//
// Left alone that is two failures at once. The lookup never happens, because
// nothing asked us to run it — and the markup lands in the chat bubble, where
// the reader sees angle brackets instead of a film recommendation.
//
// **The fix, in two halves.** `ToolCallTextFilter` sits between the model and
// the screen and never lets that markup through, holding back even a partial
// `<tool_` in case the rest is coming. `parseTextToolCalls` then reads what it
// held back and turns it into the same shape a well-behaved model would have
// sent, so the rest of the route doesn't need to know the difference.
//
// This is a compatibility shim, not a feature. If the model does the right
// thing, none of this code does anything at all.

/** The opening marker. Everything from here on is the model talking to us. */
const MARKER = "<tool_call>";

/** `<tool_call>name … </tool_call>` */
const CALL = /<tool_call>\s*([A-Za-z0-9_-]+)?\s*([\s\S]*?)<\/tool_call>/g;
/** `<arg_key>query</arg_key><arg_value>Heat</arg_value>` */
const ARG =
  /<arg_key>([\s\S]*?)<\/arg_key>\s*<arg_value>([\s\S]*?)<\/arg_value>/g;

export type TextToolCall = { name: string; args: string };

/**
 * How many characters at the end of `text` might be the start of `MARKER`.
 * "…and <tool_" scores 6, so those 6 are held back until we know whether the
 * rest of the marker follows. Without this the reader sees a flash of `<tool_`
 * before we realise what it was.
 */
function danglingMarkerLength(text: string) {
  const most = Math.min(MARKER.length - 1, text.length);
  for (let length = most; length > 0; length--) {
    if (MARKER.startsWith(text.slice(text.length - length))) return length;
  }
  return 0;
}

/**
 * Decides what is safe to put on screen as the answer streams in.
 *
 * Feed it each chunk; it returns only the text a reader should see. Anything
 * from the first `<tool_call>` onwards is kept back for `finish()`.
 */
export class ToolCallTextFilter {
  /** Text seen but not yet released. */
  private held = "";
  /** True once `<tool_call>` has appeared — from then on, nothing is shown. */
  private inToolCall = false;

  /** Add a chunk from the model; get back the part that's safe to display. */
  push(chunk: string): string {
    this.held += chunk;

    if (this.inToolCall) return "";

    const markerAt = this.held.indexOf(MARKER);
    if (markerAt !== -1) {
      // Anything written before the call is a real answer — show that, keep
      // the rest.
      const before = this.held.slice(0, markerAt);
      this.held = this.held.slice(markerAt);
      this.inToolCall = true;
      return before;
    }

    const dangling = danglingMarkerLength(this.held);
    const safe = this.held.slice(0, this.held.length - dangling);
    this.held = this.held.slice(this.held.length - dangling);
    return safe;
  }

  /**
   * The stream ended. Returns any last safe text, plus the raw markup to parse.
   * A `<tool_` that turned out to be ordinary text is released here.
   */
  finish(): { text: string; toolCallText: string } {
    if (this.inToolCall) {
      const toolCallText = this.held;
      this.held = "";
      return { text: "", toolCallText };
    }

    const text = this.held;
    this.held = "";
    return { text, toolCallText: "" };
  }
}

/** Read `{"name": "x", "arguments": {…}}` written between the markers. */
function parseJsonBody(body: string): TextToolCall | null {
  try {
    const parsed = JSON.parse(body.trim());
    const name = parsed?.name;
    if (typeof name !== "string" || !name) return null;
    const args = parsed.arguments ?? parsed.parameters ?? {};
    return {
      name,
      args: typeof args === "string" ? args : JSON.stringify(args),
    };
  } catch {
    return null;
  }
}

/**
 * Turn the markup back into the calls a well-behaved model would have sent.
 * Anything unreadable is dropped rather than guessed at — a wrong tool call is
 * worse than none.
 */
export function parseTextToolCalls(text: string): TextToolCall[] {
  if (!text.includes(MARKER)) return [];

  const calls: TextToolCall[] = [];

  // `matchAll` needs the regex reset between uses, so build fresh copies.
  for (const match of text.matchAll(new RegExp(CALL))) {
    const [, name, body = ""] = match;

    // Some models put JSON between the markers instead of arg tags.
    if (!name) {
      const fromJson = parseJsonBody(body);
      if (fromJson) calls.push(fromJson);
      continue;
    }

    const args: Record<string, string> = {};
    for (const arg of body.matchAll(new RegExp(ARG))) {
      args[arg[1].trim()] = arg[2].trim();
    }

    if (Object.keys(args).length === 0) {
      // No arg tags — the body may itself be JSON, e.g. <tool_call>{"query":…}
      const fromJson = parseJsonBody(body);
      calls.push(fromJson ?? { name, args: "{}" });
      continue;
    }

    calls.push({ name, args: JSON.stringify(args) });
  }

  return calls;
}
