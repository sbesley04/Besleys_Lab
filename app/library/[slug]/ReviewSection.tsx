"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { REVIEW_MAX_LENGTH } from "@/lib/library";

// Visitor reviews under a book: post/update your own (one per account),
// delete your own, and — as admin — moderate any. Server passes the current
// list; after a change we router.refresh() so the server re-renders it.

export interface ReviewItem {
  id: string;
  body: string;
  rating: number | null;
  userId: string;
  userName: string;
  createdAt: string;
}

function Stars({ n }: { n: number }) {
  return (
    <span aria-label={`${n} out of 5`} style={{ color: "var(--accent)", letterSpacing: "0.1em" }}>
      {"★".repeat(n)}
      <span style={{ opacity: 0.3 }}>{"★".repeat(5 - n)}</span>
    </span>
  );
}

export default function ReviewSection({
  bookId,
  reviews,
}: {
  bookId: string;
  reviews: ReviewItem[];
}) {
  const { data: session } = useSession();
  const router = useRouter();
  const me = session?.user;
  const mine = me ? reviews.find((r) => r.userId === me.id) : undefined;

  const [body, setBody] = useState(mine?.body ?? "");
  const [rating, setRating] = useState<number>(mine?.rating ?? 0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!body.trim()) {
      setError("Write something before posting.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/books/${bookId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, rating: rating || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Couldn't post your review — try again.");
      } else {
        setNotice(mine ? "Review updated." : "Review posted — thanks!");
        router.refresh();
      }
    } catch {
      setError("Network error — your review wasn't posted.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(reviewId?: string) {
    setBusy(true);
    setError(null);
    try {
      const url = reviewId
        ? `/api/books/${bookId}/reviews?reviewId=${reviewId}`
        : `/api/books/${bookId}/reviews`;
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Delete failed.");
      } else {
        if (!reviewId) {
          setBody("");
          setRating(0);
        }
        setNotice("Review removed.");
        router.refresh();
      }
    } catch {
      setError("Network error — nothing was deleted.");
    } finally {
      setBusy(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    fontFamily: "var(--font-body)",
    fontSize: "0.95rem",
    padding: "0.6rem 0.75rem",
    border: "1px solid var(--line)",
    borderRadius: 4,
    background: "var(--paper)",
    color: "var(--ink)",
    width: "100%",
  };

  return (
    <section aria-label="Reader reviews" style={{ marginTop: "2.5rem" }}>
      <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.6rem", margin: "0 0 0.25rem" }}>
        Reader reviews
      </h2>
      <p style={{ color: "var(--ink-soft)", fontSize: "0.9rem", margin: "0 0 1.25rem" }}>
        {reviews.length === 0
          ? "No reviews yet — be the first."
          : `${reviews.length} review${reviews.length === 1 ? "" : "s"} from readers.`}
      </p>

      {reviews.length > 0 && (
        <ul style={{ listStyle: "none", margin: "0 0 1.5rem", padding: 0, display: "grid", gap: "0.9rem" }}>
          {reviews.map((r) => (
            <li key={r.id} className="paper-card" style={{ padding: "1rem 1.2rem" }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "0.4rem 0.9rem" }}>
                <strong style={{ fontSize: "0.92rem" }}>{r.userName}</strong>
                {r.rating ? <Stars n={r.rating} /> : null}
                <span style={{ color: "var(--ink-soft)", fontSize: "0.78rem" }}>
                  {new Date(r.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                </span>
                {(me?.id === r.userId || me?.role === "ADMIN") && (
                  <button
                    type="button"
                    onClick={() => remove(me?.id === r.userId ? undefined : r.id)}
                    disabled={busy}
                    style={{
                      marginLeft: "auto",
                      background: "none",
                      border: "none",
                      color: "#9b3a2f",
                      fontSize: "0.8rem",
                      cursor: "pointer",
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>
              <p style={{ margin: "0.5rem 0 0", fontSize: "0.95rem", whiteSpace: "pre-wrap" }}>{r.body}</p>
            </li>
          ))}
        </ul>
      )}

      {me ? (
        <form onSubmit={submit} className="paper-card" style={{ padding: "1.25rem 1.4rem", display: "grid", gap: "0.8rem" }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.75rem" }}>
            <strong style={{ fontSize: "0.95rem" }}>{mine ? "Update your review" : "Add your review"}</strong>
            <label style={{ fontSize: "0.85rem", color: "var(--ink-soft)", display: "flex", alignItems: "center", gap: "0.4rem" }}>
              Rating
              <select
                value={rating}
                onChange={(e) => setRating(Number(e.target.value))}
                style={{ ...inputStyle, width: "auto", padding: "0.35rem 0.5rem" }}
              >
                <option value={0}>—</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {"★".repeat(n)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={REVIEW_MAX_LENGTH}
            rows={4}
            placeholder="What did you think?"
            style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
            aria-label="Your review"
          />
          {error && (
            <p role="alert" style={{ color: "#9b3a2f", fontSize: "0.88rem", margin: 0 }}>
              {error}
            </p>
          )}
          {notice && (
            <p role="status" style={{ color: "var(--ink-soft)", fontSize: "0.88rem", margin: 0 }}>
              {notice}
            </p>
          )}
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              type="submit"
              disabled={busy}
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "0.95rem",
                fontWeight: 600,
                padding: "0.55rem 1.1rem",
                border: "1px solid var(--accent)",
                borderRadius: 4,
                background: "var(--accent)",
                color: "var(--paper)",
                cursor: busy ? "default" : "pointer",
              }}
            >
              {busy ? "Posting…" : mine ? "Update review" : "Post review"}
            </button>
          </div>
        </form>
      ) : (
        <p className="paper-card" style={{ padding: "1rem 1.25rem", fontSize: "0.92rem", color: "var(--ink-soft)" }}>
          <Link href={`/login?callbackUrl=${encodeURIComponent(`/library`)}`}>Sign in</Link> or{" "}
          <Link href="/signup">create an account</Link> to leave a review.
        </p>
      )}
    </section>
  );
}
