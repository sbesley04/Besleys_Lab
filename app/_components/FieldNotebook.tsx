"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Snapshot from "./Snapshot";
import type { FieldNoteEntry } from "@/lib/fieldNotes";
import { isExternalImage } from "@/lib/images";

// The home-page photo strip, now interactive: every print is a button that
// expands into a full-screen lightbox. Click anywhere (or Esc / the × button)
// to put the print back; ← → browse neighbours.

export default function FieldNotebook({ notes }: { notes: FieldNoteEntry[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const lastTrigger = useRef<HTMLElement | null>(null);

  const close = useCallback(() => {
    setOpenIndex(null);
    lastTrigger.current?.focus();
  }, []);

  const isOpen = openIndex !== null;

  // Keyboard: Esc closes, arrows browse, and Tab stays within the modal's
  // close/previous/next controls. Depending on the boolean open state (rather
  // than the current photo index) also prevents focus jumping back to Close
  // after every Previous/Next action.
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setOpenIndex((i) => (i === null ? i : Math.min(notes.length - 1, i + 1)));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setOpenIndex((i) => (i === null ? i : Math.max(0, i - 1)));
      } else if (e.key === "Tab" && dialogRef.current) {
        const controls = Array.from(
          dialogRef.current.querySelectorAll<HTMLButtonElement>("button:not([disabled])"),
        ).filter((button) => button.offsetParent !== null);
        if (controls.length === 0) return;
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => closeRef.current?.focus());
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, notes.length, close]);

  const activeNote = openIndex !== null ? notes[openIndex] : null;

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

      {activeNote && (
        <div
          ref={dialogRef}
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`Photo: ${activeNote.caption}`}
          onClick={close}
        >
          <button
            ref={closeRef}
            type="button"
            className="lightbox-close"
            onClick={(e) => {
              e.stopPropagation();
              close();
            }}
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
                src={activeNote.image}
                alt={activeNote.alt}
                fill
                sizes="100vw"
                style={{ objectFit: "contain" }}
                priority
                unoptimized={isExternalImage(activeNote.image)}
              />
            </div>
            <figcaption className="snapshot-caption lightbox-caption" aria-live="polite">
              {activeNote.caption}
            </figcaption>
          </figure>
        </div>
      )}
    </>
  );
}
