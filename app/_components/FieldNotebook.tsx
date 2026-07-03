"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Snapshot from "./Snapshot";
import type { FieldNoteEntry } from "@/lib/fieldNotes";

// The home-page photo strip, now interactive: every print is a button that
// expands into a full-screen lightbox. Click anywhere (or Esc / the × button)
// to put the print back; ← → browse neighbours.

export default function FieldNotebook({ notes }: { notes: FieldNoteEntry[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const lastTrigger = useRef<HTMLElement | null>(null);

  const close = useCallback(() => {
    setOpenIndex(null);
    lastTrigger.current?.focus();
  }, []);

  // Keyboard: Esc closes, arrows browse. Lock page scroll while open.
  useEffect(() => {
    if (openIndex === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") setOpenIndex((i) => (i === null ? i : Math.min(notes.length - 1, i + 1)));
      else if (e.key === "ArrowLeft") setOpenIndex((i) => (i === null ? i : Math.max(0, i - 1)));
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [openIndex, notes.length, close]);

  const open = openIndex !== null ? notes[openIndex] : null;

  return (
    <>
      <div className="photo-strip">
        {notes.map((note, i) => (
          <button
            key={note.id}
            type="button"
            className="snapshot-button"
            onClick={(e) => {
              lastTrigger.current = e.currentTarget;
              setOpenIndex(i);
            }}
            aria-label={`View photo: ${note.caption}`}
            aria-haspopup="dialog"
          >
            <Snapshot
              src={note.image}
              alt={note.alt}
              caption={note.caption}
              tilt={note.tilt}
              aspect="4 / 5"
              sizes="240px"
            />
          </button>
        ))}
      </div>

      {open && (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`Photo: ${open.caption}`}
          onClick={close}
        >
          <button
            ref={closeRef}
            type="button"
            className="lightbox-close"
            onClick={close}
            aria-label="Close photo"
          >
            ✕
          </button>

          {openIndex! > 0 && (
            <button
              type="button"
              className="lightbox-nav lightbox-prev"
              onClick={(e) => {
                e.stopPropagation();
                setOpenIndex(openIndex! - 1);
              }}
              aria-label="Previous photo"
            >
              ←
            </button>
          )}
          {openIndex! < notes.length - 1 && (
            <button
              type="button"
              className="lightbox-nav lightbox-next"
              onClick={(e) => {
                e.stopPropagation();
                setOpenIndex(openIndex! + 1);
              }}
              aria-label="Next photo"
            >
              →
            </button>
          )}

          <figure className="lightbox-figure">
            <div className="lightbox-frame">
              <Image
                src={open.image}
                alt={open.alt}
                fill
                sizes="100vw"
                style={{ objectFit: "contain" }}
                priority
              />
            </div>
            <figcaption className="snapshot-caption lightbox-caption">{open.caption}</figcaption>
          </figure>
        </div>
      )}
    </>
  );
}
