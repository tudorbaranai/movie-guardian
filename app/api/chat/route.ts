// POST /api/chat — the movie assistant behind the ✨ button in the nav bar.
//
// The shape of one request:
//
//   browser                       this route                       Vercel AI Gateway
//   -------                       ----------                       -----------------
//   the chat so far    ──────▶    1. who are you? (Supabase)
//   + your access token           2. read YOUR user_movies rows
//                                 3. write a system prompt from them
//                                 4. ask the model, streaming ─────▶  a model
//   words appear       ◀──────    5. rewrite **titles** into links, and
//                                    forward each word as it arrives ◀──
//
// It streams, so the answer types itself out instead of appearing after a long
// silence. Signing in is required: the whole point is personal answers, and an
// AI endpoint anyone on the internet could hammer would cost real money.
//
// **Exactly one trip to the model per question**, because AI_TOOL_ROUNDS is 0 by
// default. That is the whole reason this works on a free account — see lib/ai.ts.
// The film links don't need the model: lib/movie-links.ts resolves the titles it
// writes in **bold** against TMDB as the words go past, for free.
//
// Turn AI_TOOL_ROUNDS up (with credits) and step 4 starts repeating instead: the
// model asks for a lookup, that round produces no words, we run it and ask again.
import type OpenAI from "openai";
import {
  AI_FALLBACK_MODELS,
  AI_MODEL,
  AI_REASONING_EFFORT,
  AI_TOOL_ROUNDS,
  ai,
  aiIsConfigured,
} from "@/lib/ai";
import { MovieLinkEnricher } from "@/lib/movie-links";
import { MOVIE_TOOLS, runMovieTool } from "@/lib/movie-tools";
import { bearerToken, supabaseForToken } from "@/lib/supabase-server";
import { ToolCallTextFilter, parseTextToolCalls } from "@/lib/text-tool-calls";
import {
  buildSystemPrompt,
  buildWatchHistory,
  type WatchedMovie,
} from "@/lib/watch-history";

// Streaming answers can outlive the default serverless time limit.
export const maxDuration = 60;

/** Longest single message we accept, in characters. */
const MAX_MESSAGE_LENGTH = 1000;
/** How many past turns we send back. Older ones are dropped, oldest first. */
const MAX_TURNS = 20;
// Room for the answer. This budget also pays for the model's private
// "thinking" tokens, so it's roomier than the few sentences we ask for.
const MAX_TOKENS = 2048;
// When the free tier says "too many requests", waiting is usually enough: the
// allowance is about five a minute and comes back after roughly half a minute.
// So rather than giving up and showing an error, we pause and try again — the
// reader just sees the typing dots for a little longer.
//
// The ceiling itself can't be raised. It is account-wide, not per-model: once
// it's hit, EVERY free model answers 429, so no amount of falling back to
// another one helps (measured 2026-09-18). These waits fit inside `maxDuration`
// with room for the answer itself.
const RATE_LIMIT_WAITS_MS = [9_000, 21_000];

// A model asked to look things up will happily fire a search for every film it
// is considering — we watched one send eight in a single turn. Each is a real
// TMDB request and more text to pay for, so cap them.
const MAX_CALLS_PER_ROUND = 3;

// Our OWN brake on one person, not the gateway's. Named carefully because
// RATE_LIMIT_WAITS_MS above is an unrelated thing — that one is how long we
// wait out the *gateway* saying no; this one is how often *we* say no.
// It earns its keep mainly as insurance for the day this runs on a paid model
// and something loops.
const MESSAGES_PER_HOUR = 20;
const MESSAGE_WINDOW_MS = 60 * 60 * 1000;

// A plain Map is a per-server-process memory, so this is a speed bump rather
// than a vault: a second server instance has its own counter. The real spend
// limit is the budget set on the Vercel AI Gateway dashboard.
const recentCalls = new Map<string, number[]>();

function overRateLimit(userId: string) {
  const now = Date.now();
  const calls = (recentCalls.get(userId) ?? []).filter(
    (at) => now - at < MESSAGE_WINDOW_MS,
  );
  if (calls.length >= MESSAGES_PER_HOUR) {
    recentCalls.set(userId, calls);
    return true;
  }
  calls.push(now);
  recentCalls.set(userId, calls);
  return false;
}

/** Ask the model, waiting out a rate limit rather than failing on it. */
async function askModel(
  params: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming,
) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await ai().chat.completions.create(params);
    } catch (problem) {
      const rateLimited = (problem as { status?: number })?.status === 429;
      if (!rateLimited || attempt >= RATE_LIMIT_WAITS_MS.length) throw problem;

      console.warn(
        `Chat: rate-limited, waiting ${RATE_LIMIT_WAITS_MS[attempt]}ms`,
      );
      await new Promise((resume) =>
        setTimeout(resume, RATE_LIMIT_WAITS_MS[attempt]),
      );
    }
  }
}

function fail(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

/**
 * Turn a gateway failure into a sentence that says what to actually DO.
 *
 * This matters more than it looks. By the time the model is called we have
 * already started streaming, so we cannot change the HTTP status — whatever we
 * say here IS the error message. A generic "something went wrong" sent us
 * hunting through code for what turned out to be an account setting.
 */
function explain(problem: unknown) {
  const status = (problem as { status?: number })?.status;

  if (status === 401) {
    return "The AI key was refused. Check AI_GATEWAY_API_KEY.";
  }
  if (status === 402) {
    return "The AI spend budget is used up. Raise it in Vercel → AI Gateway → Budgets.";
  }
  if (status === 403) {
    return `This Vercel account can't use ${AI_MODEL}. Free-tier accounts only get a few models — buy AI Gateway credits, or set AI_MODEL to one you can use.`;
  }
  if (status === 429) {
    // We already waited and retried twice before getting here, so the
    // allowance is properly spent rather than momentarily busy.
    return "That was a lot of questions at once — the free AI allowance is about five a minute. Give it a minute and ask again.";
  }
  return "Sorry — that answer got cut off. Try again.";
}

/** Keep only well-formed { role, content } turns, and trim them to size. */
function cleanMessages(
  input: unknown,
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] | null {
  if (!Array.isArray(input) || input.length === 0) return null;

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
  for (const item of input) {
    const role = (item as { role?: unknown })?.role;
    const content = (item as { content?: unknown })?.content;
    if (role !== "user" && role !== "assistant") return null;
    if (typeof content !== "string" || !content.trim()) return null;
    messages.push({ role, content: content.slice(0, MAX_MESSAGE_LENGTH) });
  }

  // A conversation has to start with the person, not with an answer — so
  // after cutting old turns, drop any reply left stranded at the front.
  const trimmed = messages.slice(-MAX_TURNS);
  while (trimmed.length > 0 && trimmed[0].role !== "user") trimmed.shift();
  return trimmed.length > 0 ? trimmed : null;
}

export async function POST(request: Request) {
  if (!aiIsConfigured()) {
    return fail("The movie assistant isn't switched on yet.", 503);
  }

  const token = bearerToken(request);
  if (!token) return fail("Sign in to use the movie assistant.", 401);

  const supabase = supabaseForToken(token);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return fail("Sign in to use the movie assistant.", 401);

  if (overRateLimit(userData.user.id)) {
    return fail("That's a lot of questions! Try again in a little while.", 429);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Bad request.", 400);
  }

  const messages = cleanMessages((body as { messages?: unknown })?.messages);
  if (!messages) return fail("Bad request.", 400);

  // Row-Level Security means this can only ever return THIS person's rows.
  const { data: rows, error } = await supabase
    .from("user_movies")
    .select("title, status, rating, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Chat: couldn't read user_movies:", error.message);
    return fail("We couldn't read your movies just now. Try again.", 502);
  }

  const system = buildSystemPrompt(
    buildWatchHistory((rows ?? []) as WatchedMovie[]),
    AI_TOOL_ROUNDS > 0,
  );

  // Hand the browser a stream it can read word by word. We send plain text,
  // not JSON: the client just appends whatever arrives to the bubble on screen.
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // The conversation we keep extending: house rules, then the chat, then
      // any tool calls the model makes and the answers we give it.
      // The house rules go in front as a "system" message — the model treats
      // those as instructions rather than as something to reply to.
      const thread: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: "system", content: system },
        ...messages,
      ];

      try {
        for (let round = 0; ; round++) {
          // On the final round we offer no tools at all, which forces the
          // model to stop looking things up and actually answer. With
          // AI_TOOL_ROUNDS at 0 that is true immediately, so no tools are ever
          // offered and one question costs exactly one request.
          const lastRound = round >= AI_TOOL_ROUNDS;

          const answer = await askModel({
            model: AI_MODEL,
            max_completion_tokens: MAX_TOKENS,
            stream: true,
            messages: thread,
            ...(lastRound ? {} : { tools: MOVIE_TOOLS }),
            // Only sent when the chosen model actually understands it — see
            // AI_REASONING_EFFORT in lib/ai.ts for why that matters.
            ...(AI_REASONING_EFFORT
              ? { reasoning_effort: AI_REASONING_EFFORT }
              : {}),
            // `providerOptions` is a Vercel AI Gateway extension, so it isn't
            // in OpenAI's own types — hence the spread rather than a plain
            // property. It tells the gateway which models to try next if this
            // one is busy, rate-limited or down.
            ...(AI_FALLBACK_MODELS.length > 0
              ? {
                  providerOptions: {
                    gateway: { models: AI_FALLBACK_MODELS },
                  },
                }
              : {}),
          } as OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming);

          // A tool call arrives in crumbs, exactly like the text does: first
          // the name, then the arguments a few characters at a time. We glue
          // them back together by their `index` before running anything.
          const wanted: { id: string; name: string; args: string }[] = [];
          // Two filters, in order. The first guards the screen against models
          // that write their tool calls out as text instead of sending them as
          // data; the second swaps **bold titles** for links to our own pages.
          const screen = new ToolCallTextFilter();
          const links = new MovieLinkEnricher();

          for await (const chunk of answer) {
            const choice = chunk.choices[0];
            if (!choice) continue;

            const piece = choice.delta?.content;
            if (piece) {
              const safe = screen.push(piece);
              if (safe) {
                const linked = await links.push(safe);
                if (linked) controller.enqueue(encoder.encode(linked));
              }
            }

            for (const call of choice.delta?.tool_calls ?? []) {
              const slot = (wanted[call.index] ??= {
                id: "",
                name: "",
                args: "",
              });
              if (call.id) slot.id = call.id;
              if (call.function?.name) slot.name = call.function.name;
              if (call.function?.arguments)
                slot.args += call.function.arguments;
            }
          }

          const { text: tail, toolCallText } = screen.finish();
          const lastWords = (await links.push(tail)) + (await links.finish());
          if (lastWords) controller.enqueue(encoder.encode(lastWords));

          // `wanted` is a sparse array when indexes arrive out of order.
          // A model that did it properly wins; otherwise fall back to whatever
          // it wrote in prose, given the same shape so the rest doesn't care.
          const structured = wanted.filter(Boolean);
          const calls =
            structured.length > 0
              ? structured
              : parseTextToolCalls(toolCallText).map((call, index) => ({
                  id: `text_${round}_${index}`,
                  name: call.name,
                  args: call.args,
                }));

          if (lastRound || calls.length === 0) break;

          // Ignore anything past the cap rather than running all of them.
          calls.length = Math.min(calls.length, MAX_CALLS_PER_ROUND);

          // Record what the model asked for…
          thread.push({
            role: "assistant",
            content: null,
            tool_calls: calls.map((call) => ({
              id: call.id,
              type: "function",
              function: { name: call.name, arguments: call.args },
            })),
          });

          // …then run them all at once and hand back the trimmed answers.
          const results = await Promise.all(
            calls.map((call) => runMovieTool(call.name, call.args)),
          );
          results.forEach((result, index) => {
            thread.push({
              role: "tool",
              tool_call_id: calls[index].id,
              content: JSON.stringify(result),
            });
          });
        }
      } catch (streamError) {
        // The headers are long gone by now, so we can't change the status
        // code — the only way to tell the reader is to say it in the text.
        console.error("Chat: the model call failed:", streamError);
        controller.enqueue(encoder.encode(`\n\n⚠️ ${explain(streamError)}`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      // Stops proxies from holding the answer back to buffer it.
      "X-Accel-Buffering": "no",
    },
  });
}
