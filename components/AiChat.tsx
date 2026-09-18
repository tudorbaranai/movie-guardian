"use client";

// The ✨ sticker in the nav bar and the little chat window it opens.
//
// It talks to our own `/api/chat`, never to an AI company directly — the key
// for that lives on the server and must never reach a browser.
//
// The one unusual bit is how the answer arrives. A normal `fetch` waits for the
// whole reply, then hands it over; here we read the response *as it is still
// being written*, a few characters at a time, and repaint the bubble on every
// chunk. That's what makes the words appear to type themselves.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import styles from "./AiChat.module.css";

type Message = { role: "user" | "assistant"; content: string };

const STARTERS = [
  "What should I watch tonight?",
  "Something like the films I rated highest",
  "A short, funny film under 100 minutes",
];

const GREETING =
  "Hi! I'm your movie guide. I know what you've watched, rated and put on your watchlist — ask me what to watch next.";

// Two things the model is asked to write, and the only two we render specially:
// a link to one of our own movie pages — [Heat (1995)](/movie/949) — and
// **bold**, which it still reaches for out of habit.
//
// `/movie/\d+` is deliberately strict. The model is told to link only to our
// own pages, but a model does what it usually does, not what it is told, so
// this pattern is the thing that actually enforces it: anything that isn't our
// own address with a plain number on the end never becomes a link at all, it
// just stays as text. That's why there's no `http` here to allow — a chat
// bubble should never be able to hand someone a link to somewhere else.
const MARKUP = /(\[[^\]\n]+\]\(\/movie\/\d+\)|\*\*[^*\n]+\*\*)/g;
const MOVIE_LINK = /^\[([^\]]+)\]\((\/movie\/\d+)\)$/;

/**
 * Render the model's answer. Deliberately tiny: we are not adding a Markdown
 * library for two patterns, and model output never goes into the page as raw
 * HTML — React escapes every string below, so it can't smuggle in markup.
 */
function Formatted({
  text,
  onNavigate,
}: {
  text: string;
  onNavigate: () => void;
}) {
  return (
    <>
      {text.split(MARKUP).map((piece, index) => {
        const link = piece.match(MOVIE_LINK);
        if (link) {
          return (
            <Link
              key={index}
              href={link[2]}
              className={styles.titleLink}
              // The header survives the page change, so without this the panel
              // would still be sitting on top of the film you just opened.
              onClick={onNavigate}
            >
              {link[1]}
            </Link>
          );
        }

        if (
          piece.startsWith("**") &&
          piece.endsWith("**") &&
          piece.length > 4
        ) {
          return (
            <strong key={index} className={styles.title}>
              {piece.slice(2, -2)}
            </strong>
          );
        }

        return <span key={index}>{piece}</span>;
      })}
    </>
  );
}

export default function AiChat({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Close on a click outside or on Escape — the same behaviour as the
  // account menu next to it, so the header feels consistent.
  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  // Put the cursor in the box when the panel opens.
  useEffect(() => {
    if (open && signedIn) inputRef.current?.focus();
  }, [open, signedIn]);

  // Keep the newest words in view as they stream in.
  useEffect(() => {
    const box = scrollRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [messages, busy]);

  async function send(question: string) {
    const text = question.trim();
    if (!text || busy) return;

    setInput("");
    setError(null);
    setBusy(true);

    const history = [...messages, { role: "user" as const, content: text }];
    // Show the question straight away, plus an empty bubble for the answer
    // that the stream will fill in.
    setMessages([...history, { role: "assistant", content: "" }]);

    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) throw new Error("Your session expired. Sign in again.");

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ messages: history }),
      });

      if (!response.ok || !response.body) {
        const problem = await response.json().catch(() => null);
        throw new Error(problem?.error ?? "The assistant isn't answering.");
      }

      // `getReader()` hands us the answer in pieces, in the order they arrive.
      // A TextDecoder with `stream: true` stitches them back into text —
      // needed because a chunk can split a multi-byte character (an emoji!)
      // straight down the middle.
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let answer = "";

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        // Replace the last bubble with everything received so far.
        setMessages([...history, { role: "assistant", content: answer }]);
      }

      if (!answer.trim()) throw new Error("The assistant had nothing to say.");
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Something broke.");
      // Drop the empty answer bubble so the error isn't shown twice.
      setMessages(history);
    } finally {
      setBusy(false);
    }
  }

  // The typing dots only show while the answer bubble is still empty.
  const waiting = busy && messages[messages.length - 1]?.content === "";

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={open ? styles.stickerOpen : styles.sticker}
        onClick={() => setOpen((isOpen) => !isOpen)}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Ask the movie assistant"
      >
        <span className={styles.stickerIcon} aria-hidden="true">
          ✨
        </span>
        <span className={styles.stickerText}>AI</span>
      </button>

      {open && (
        <div
          className={styles.panel}
          role="dialog"
          aria-label="Movie assistant"
        >
          <div className={styles.head}>
            <span className={styles.headTitle}>
              <span aria-hidden="true">✨</span> Movie assistant
            </span>
            <button
              type="button"
              className={styles.close}
              onClick={() => setOpen(false)}
              aria-label="Close the movie assistant"
            >
              ✕
            </button>
          </div>

          {!signedIn ? (
            <div className={styles.signedOut}>
              <p className={styles.signedOutText}>
                Sign in and the assistant can use what you&apos;ve watched,
                rated and saved to suggest what to watch next.
              </p>
              <Link
                href="/login"
                className={styles.signInButton}
                onClick={() => setOpen(false)}
              >
                Sign in
              </Link>
            </div>
          ) : (
            <>
              <div className={styles.messages} ref={scrollRef}>
                <div className={`${styles.bubble} ${styles.fromAi}`}>
                  {GREETING}
                </div>

                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`${styles.bubble} ${
                      message.role === "user" ? styles.fromYou : styles.fromAi
                    }`}
                  >
                    <Formatted
                      text={message.content}
                      onNavigate={() => setOpen(false)}
                    />
                  </div>
                ))}

                {waiting && (
                  <div
                    className={`${styles.bubble} ${styles.fromAi} ${styles.thinking}`}
                    role="status"
                  >
                    <span className={styles.dot} />
                    <span className={styles.dot} />
                    <span className={styles.dot} />
                    <span className="srOnly">Thinking…</span>
                  </div>
                )}

                {messages.length === 0 && (
                  <div className={styles.starters}>
                    {STARTERS.map((starter) => (
                      <button
                        key={starter}
                        type="button"
                        className={styles.starter}
                        onClick={() => send(starter)}
                      >
                        {starter}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {error && (
                <p className={styles.error} role="alert">
                  {error}
                </p>
              )}

              <form
                className={styles.form}
                onSubmit={(event) => {
                  event.preventDefault();
                  send(input);
                }}
              >
                <label htmlFor="ai-chat-input" className="srOnly">
                  Ask about movies
                </label>
                <input
                  id="ai-chat-input"
                  ref={inputRef}
                  className={styles.input}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Ask about movies…"
                  maxLength={1000}
                  autoComplete="off"
                  disabled={busy}
                />
                <button
                  type="submit"
                  className={styles.send}
                  disabled={busy || !input.trim()}
                >
                  Send
                </button>
              </form>

              <p className={styles.footnote}>
                AI can get things wrong — check before you press play.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
