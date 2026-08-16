"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { REVIEW_MAX_LENGTH } from "@/lib/library";
import styles from "./detail.module.css";

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
    <span role="img" aria-label={`${n} out of 5 stars`} className={styles.stars}>
      <span aria-hidden="true">{"★".repeat(n)}</span>
      <span className={styles.mutedStars} aria-hidden="true">
        {"★".repeat(5 - n)}
      </span>
    </span>
  );
}

export default function ReviewSection({
  bookId,
  bookSlug,
  reviews,
  currentUser,
}: {
  bookId: string;
  bookSlug: string;
  reviews: ReviewItem[];
  currentUser: { id: string; role?: string | null } | null;
}) {
  const router = useRouter();
  const me = currentUser;
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

  async function remove(reviewId?: string, reviewer?: string) {
    const label = reviewId ? `${reviewer ?? "this reader"}'s review` : "your review";
    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return;

    setBusy(true);
    setError(null);
    setNotice(null);
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

  const messageIds = [error ? "review-error" : null, notice ? "review-notice" : null, "review-count"]
    .filter(Boolean)
    .join(" ");

  return (
    <section aria-labelledby="reader-reviews-title" className={styles.reviewSection}>
      <h2 id="reader-reviews-title" className={styles.reviewHeading}>
        Reader reviews
      </h2>
      <p className={styles.reviewSummary}>
        {reviews.length === 0
          ? "No reviews yet — be the first."
          : `${reviews.length} review${reviews.length === 1 ? "" : "s"} from readers.`}
      </p>

      {reviews.length > 0 && (
        <ul className={styles.reviewList}>
          {reviews.map((r) => (
            <li key={r.id} className={`paper-card ${styles.reviewCard}`}>
              <div className={styles.reviewMeta}>
                <strong className={styles.reviewer}>{r.userName}</strong>
                {r.rating ? <Stars n={r.rating} /> : null}
                <time dateTime={r.createdAt} className={styles.reviewDate}>
                  {new Date(r.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    timeZone: "UTC",
                  })}
                </time>
                {(me?.id === r.userId || me?.role === "ADMIN") && (
                  <button
                    type="button"
                    onClick={() => remove(me?.id === r.userId ? undefined : r.id, r.userName)}
                    disabled={busy}
                    className={styles.deleteButton}
                    aria-label={
                      me?.id === r.userId ? "Delete your review" : `Delete review by ${r.userName}`
                    }
                  >
                    Delete
                  </button>
                )}
              </div>
              <p className={styles.reviewBody}>{r.body}</p>
            </li>
          ))}
        </ul>
      )}

      {me ? (
        <form onSubmit={submit} className={`paper-card ${styles.reviewForm}`} aria-labelledby="review-form-title">
          <div className={styles.formHeader}>
            <h3 id="review-form-title" className={styles.formTitle}>
              {mine ? "Update your review" : "Add your review"}
            </h3>
            <label className={styles.ratingField}>
              Rating
              <select
                value={rating}
                onChange={(e) => setRating(Number(e.target.value))}
                className={`${styles.input} ${styles.select}`}
              >
                <option value={0}>No rating</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? "star" : "stars"} — {"★".repeat(n)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label htmlFor="review-body" className={styles.field}>
            Your review
            <textarea
              id="review-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={REVIEW_MAX_LENGTH}
              rows={4}
              placeholder="What did you think?"
              className={`${styles.input} ${styles.textarea}`}
              aria-describedby={messageIds}
            />
          </label>
          <div className={styles.fieldFooter}>
            <div>
              {error && (
                <p id="review-error" role="alert" className={styles.error}>
                  {error}
                </p>
              )}
              {notice && (
                <p id="review-notice" role="status" className={styles.message}>
                  {notice}
                </p>
              )}
            </div>
            <p id="review-count" className={styles.characterCount}>
              {body.length} / {REVIEW_MAX_LENGTH} characters
            </p>
          </div>
          <button type="submit" disabled={busy} className={styles.submitButton}>
            {busy ? "Posting…" : mine ? "Update review" : "Post review"}
          </button>
        </form>
      ) : (
        <p className={`paper-card ${styles.authCard}`}>
          <Link href={`/login?callbackUrl=${encodeURIComponent(`/library/${bookSlug}`)}`}>Sign in</Link> or{" "}
          <Link href="/signup">create an account</Link> to leave a review.
        </p>
      )}
    </section>
  );
}
