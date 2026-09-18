// The AI side of the site — one shared, server-only model client.
//
// We don't talk to an AI company directly. Every request goes through
// **Vercel AI Gateway**, which is a single door in front of many providers:
//
//     our server  ->  ai-gateway.vercel.sh  ->  OpenAI (GPT 5.6 Luna)
//
// Why bother with the extra hop?
//   * One key. `AI_GATEWAY_API_KEY` is the only AI secret we ever store, even
//     when we switch to a model from a different company — that's a one-word
//     change below, not a new account.
//   * A spend limit. Vercel's dashboard caps how much this can ever cost and
//     logs every request with its tokens and its price.
//   * Failover. If a provider is having a bad day, the gateway can retry
//     somewhere else.
//
// The gateway speaks the standard **OpenAI Chat Completions** shape, so we use
// OpenAI's own official SDK and just point its `baseURL` at Vercel. Model names
// carry a provider prefix there: "openai/gpt-5.6-luna", not "gpt-5.6-luna".
import OpenAI from "openai";

/** The levels the API accepts. A typo in .env.local is ignored, not sent. */
const EFFORT_LEVELS = [
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
] as const;

type Effort = (typeof EFFORT_LEVELS)[number];

const GATEWAY_BASE_URL = "https://ai-gateway.vercel.sh/v1";

/**
 * Which model answers.
 *
 * The default is a **free-tier** model, so the assistant works on a Vercel
 * account that has never bought credits. It needed two things: the `free` tag,
 * and the `tool-use` tag, because the assistant looks films up on TMDB
 * (lib/movie-tools.ts) and a model that can't call tools can't do that.
 *
 * The live list of what your account may call is in the Vercel dashboard under
 * AI Gateway → Models — that is the source of truth, not this comment.
 *
 * With credits bought, `openai/gpt-5.6-luna` is the better answer: far stronger,
 * and still only about $0.20 per million words in, $1.20 out.
 */
export const AI_MODEL =
  process.env.AI_MODEL ?? "inclusionai/ling-3.0-flash-vl-free";

/**
 * Models to try if the first one won't answer, in order. The gateway does the
 * retrying for us — one request, several attempts.
 *
 * This earns its place on the free tier, where models are rate-limited hard and
 * a provider can simply be down (we saw both while setting this up, Laguna
 * repeatedly answering 503). One model being busy shouldn't mean a dead chat
 * window, so the close twin of the default is tried before the other provider.
 */
export const AI_FALLBACK_MODELS = (
  process.env.AI_FALLBACK_MODELS ??
  "inclusionai/ling-3.0-flash-vl,poolside/laguna-s-2.1-free"
)
  .split(",")
  .map((model) => model.trim())
  .filter(Boolean);

/**
 * How many times the model may stop and look something up on TMDB before it has
 * to answer. **Zero by default, which means no tool calling at all.**
 *
 * That looks like a downgrade and isn't. Measured against the live free tier:
 * one question with tools on cost **three** gateway requests (the model fired
 * eight searches), and the free tier allows roughly **four requests per window**
 * — so a single question used up the whole allowance and the next two were
 * refused. With tools off it is one request per question, so the chat answers
 * four or five times as often before it hits the wall.
 *
 * Nothing is really lost: the film links still work, because lib/movie-links.ts
 * resolves titles against TMDB on the way out, for free. Turn this up to 2 once
 * the account has AI Gateway credits and the rate limit stops mattering.
 */
export const AI_TOOL_ROUNDS = Number(process.env.AI_TOOL_ROUNDS ?? "0") || 0;

/**
 * How hard the model should think before answering, if it supports being told.
 *
 * Deliberately **unset by default**, because "effort" is not universal: the
 * gateway's catalogue reports `reasoning_options: {type: "effort"}` for GPT 5.6
 * Luna, `{type: "toggle"}` for Laguna, and nothing at all for Ling. Sending a
 * level to a model that doesn't take one is a 400 and a dead answer, so we say
 * nothing unless asked. Set AI_REASONING_EFFORT=low alongside a model whose
 * dashboard entry offers an effort setting.
 */
export const AI_REASONING_EFFORT: Effort | null = (() => {
  const wanted = process.env.AI_REASONING_EFFORT?.trim();
  if (!wanted) return null;
  if ((EFFORT_LEVELS as readonly string[]).includes(wanted)) {
    return wanted as Effort;
  }
  console.warn(`Ignoring AI_REASONING_EFFORT="${wanted}" — not a known level.`);
  return null;
})();

/** True when the gateway key is configured — lets routes fail politely. */
export function aiIsConfigured() {
  return Boolean(process.env.AI_GATEWAY_API_KEY);
}

// Built once per server process and reused, so we're not making a new HTTP
// client on every message. It is NOT created at import time with a `!` on the
// key: that would crash the whole build whenever the key is missing.
let client: OpenAI | null = null;

export function ai() {
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.AI_GATEWAY_API_KEY,
      baseURL: GATEWAY_BASE_URL,
    });
  }
  return client;
}
