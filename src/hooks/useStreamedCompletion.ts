/**
 * Client hook — consumes the SSE stream from /api/ai/vision-quote.
 * Used by the lead-detail screen (frontend-developer skill consumes this).
 *
 * Returns:
 *   - text:       accumulated tokens
 *   - status:     "idle" | "streaming" | "complete" | "error"
 *   - usage:      input/output token counts (set on event=usage)
 *   - error:      string set on event=error (with [truncated] marker)
 *   - start():    initiate the stream
 *
 * On error mid-stream we keep the partial `text` and append `[truncated]` —
 * never silently fail (Phase 7 requirement).
 */

"use client";

import { useCallback, useRef, useState } from "react";

export interface VisionQuoteStreamArgs {
  quoteId: string;
  contextNote: string | null;
  photoUrls: string[];
}

export interface StreamUsage {
  input_tokens?: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  output_tokens?: number;
}

export type StreamStatus = "idle" | "streaming" | "complete" | "error";

export interface StreamedCompletion {
  text: string;
  status: StreamStatus;
  usage: StreamUsage | null;
  error: string | null;
  start: (args: VisionQuoteStreamArgs) => Promise<void>;
  abort: () => void;
}

export function useStreamedCompletion(): StreamedCompletion {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<StreamStatus>("idle");
  const [usage, setUsage] = useState<StreamUsage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const start = useCallback(async (args: VisionQuoteStreamArgs) => {
    setText("");
    setStatus("streaming");
    setUsage(null);
    setError(null);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/ai/vision-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        throw new Error(`Stream init failed: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let done = false;

      while (!done) {
        const { value, done: streamDone } = await reader.read();
        if (streamDone) {
          done = true;
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        // SSE messages are "\n\n"-delimited.
        let sep: number;
        while ((sep = buffer.indexOf("\n\n")) !== -1) {
          const block = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          const handled = handleEvent(block);
          if (handled?.event === "delta") {
            const data = handled.data as { text?: string };
            setText((prev) => prev + (data.text ?? ""));
          } else if (handled?.event === "usage") {
            setUsage(handled.data as StreamUsage);
          } else if (handled?.event === "done") {
            setStatus("complete");
          } else if (handled?.event === "error") {
            const msg = (handled.data as { message?: string })?.message ?? "stream error";
            setError(msg);
            setText((prev) => `${prev}\n\n[truncated: ${msg}]`);
            setStatus("error");
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "stream aborted";
      setError(msg);
      setText((prev) => `${prev}\n\n[truncated: ${msg}]`);
      setStatus("error");
    } finally {
      abortRef.current = null;
    }
  }, []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { text, status, usage, error, start, abort };
}

/** Parse a single SSE event block into { event, data }. */
function handleEvent(block: string): { event: string; data: unknown } | null {
  const lines = block.split("\n");
  let event = "message";
  let data = "";
  for (const line of lines) {
    if (line.startsWith("event: ")) event = line.slice(7).trim();
    else if (line.startsWith("data: ")) data += line.slice(6);
  }
  if (!data) return null;
  try {
    return { event, data: JSON.parse(data) };
  } catch {
    return { event, data };
  }
}
