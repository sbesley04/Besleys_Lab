"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { unlock, localUnlocked } from "@/lib/arcade";
import { ACHIEVEMENTS } from "@/lib/achievements";
import { SECRET_ARTIFACTS, type SecretArtifactKey } from "@/lib/secretArtifacts";
import styles from "../../games/arcade.module.css";

const THEME_NAMES = ["blueprint", "copper", "forest", "plum", "frost", "sunset", "slate", "rose", "noir"] as const;
type ThemeName = (typeof THEME_NAMES)[number];
const THEME_DIALOGUE: Partial<Record<ThemeName, string>> = {
  blueprint: "Blueprints unfurled. Mind the wet ink.",
  copper: "Workshop lights on. The tools are where you left them.",
  forest: "Field notebook open. Keep an eye on the margins.",
  plum: "Observatory log open. The sky is clear enough for notes.",
};

function isThemeName(value: string): value is ThemeName {
  return (THEME_NAMES as readonly string[]).includes(value);
}

interface TermLine {
  text: string;
  cls?: "dim" | "accent";
  artifact?: SecretArtifactKey;
}

export default function SecretTerminal() {
  const { data: session, status: sessionStatus } = useSession();
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<TermLine[]>([]);
  const [input, setInput] = useState("");
  const [rainbow, setRainbow] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const openTerminal = () => setOpen(true);
    window.addEventListener("bl:open-terminal", openTerminal);
    return () => window.removeEventListener("bl:open-terminal", openTerminal);
  }, []);

  useEffect(() => {
    if (open && sessionStatus !== "loading") {
      if (lines.length === 0) {
        print([
          { text: "BESLEY'S LAB terminal v0.53", cls: "accent" },
          { text: session?.user?.role === "ADMIN" ? "Administrator terminal ready." : "How did you get here?" },
        ]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sessionStatus]);

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => inputRef.current?.focus());

    function handleDialogKeys(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", handleDialogKeys);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", handleDialogKeys);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
  }, [lines]);

  function print(out: TermLine[]) {
    setLines((l) => [...l, ...out].slice(-200));
  }

  function run(raw: string) {
    const cmd = raw.trim();
    if (!cmd) return;
    print([{ text: `> ${cmd}`, cls: "dim" }]);
    const [head, ...rest] = cmd.toLowerCase().split(/\s+/);
    const arg = rest.join(" ");

    switch (head) {
      case "help":
        print([
          { text: "help        this" },
          { text: "motd        message of the day" },
          { text: "stats       your lab record" },
          { text: "theme <name> blueprint · copper · forest · plum · frost · sunset · slate · rose · noir" },
          { text: "theme paper  return to the default paper theme" },
          { text: "clear       wipe the screen" },
          { text: "exit        close the terminal" },
          { text: "many not listed.", cls: "dim" },
        ]);
        break;
      case "motd": {
        const motds = [
          "maybe try blueprint?",
          "day 1287 of the experiment. the games are still winning.",
          "reminder: feed the junimo. it lives behind the cards now.",
          "a snake, a spider, and 53 cards walk into a lab...",
        ];
        print([{ text: motds[Math.floor(Math.random() * motds.length)] }]);
        break;
      }
      case "stats": {
        const unlocked = localUnlocked();
        print([
          { text: `achievements: ${unlocked.size}/${ACHIEVEMENTS.length} unlocked` },
          { text: unlocked.size === ACHIEVEMENTS.length ? "completionist detected. impressive." : "keep digging.", cls: "dim" },
        ]);
        break;
      }
      case "theme":
        if (isThemeName(arg)) {
          applyTheme(arg);
          print([{ text: THEME_DIALOGUE[arg] ?? `theme enabled: ${arg}.`, cls: "accent" }]);
        } else if (arg === "paper" || arg === "default" || arg === "reset") {
          applyTheme(null);
          print([{ text: "back to paper. cozy." }]);
        } else {
          print([{ text: "Specify a theme name." }]);
        }
        break;
      case "blueprint":
        applyTheme("blueprint");
        print([{ text: THEME_DIALOGUE.blueprint ?? "theme enabled: blueprint.", cls: "accent" }]);
        break;
      case "clear":
        setLines([]);
        break;
      case "exit":
      case "quit":
        setOpen(false);
        break;

      // --- unlisted ---------------------------------------------------------
      case "synthesize":
      case "zni2":
      case "zn+i2": {
        print([
          { text: "loading crucible... Zn (powdered) + I₂ (crystals)" },
          { text: "adding a few drops of H₂O as catalyst..." },
          { text: "⚗️  Zn + I₂ → ZnI₂        ΔH < 0 (vigorously)", cls: "accent" },
          { text: "Reaction logged: zinc–iodine demonstration.", artifact: "chemist" },
        ]);
        unlock("egg-chemist");
        break;
      }
      case "train": {
        print([
          { text: "initializing model... optimizer=adam lr=3e-4" },
          { text: "epoch 1/3  loss 0.6931  val_loss 0.6928" },
          { text: "epoch 2/3  loss 0.2107  val_loss 0.2411" },
          { text: "epoch 3/3  loss 0.0001  val_loss 4.7182", cls: "accent" },
          { text: "training accuracy 100.00%. that is not the flex you think it is." },
          { text: "(did... did you leak the test set into the training data?)", cls: "dim", artifact: "overfit" },
        ]);
        unlock("egg-overfit");
        break;
      }
      case "lake":
      case "rustylake": {
        print([
          { text: "the lake is quiet today." },
          { text: "a crow watches from the mill. it seems to remember you.", cls: "dim" },
          { text: "A Lakefield node was added to your collection.", cls: "accent", artifact: "lake" },
        ]);
        unlock("egg-rusty");
        break;
      }
      case "jeb_": {
        setRainbow(true);
        try {
          localStorage.setItem("bl:jeb", "1");
        } catch { /* ignore */ }
        print([{ text: "an old name tag glows. the sheep on this page will remember this.", cls: "accent", artifact: "jeb" }]);
        unlock("egg-jeb");
        break;
      }
      case "sudo":
        print([{ text: "Nice try. This terminal does not support elevated access." }]);
        break;
      case "konami":
        print([{ text: "↑ ↑ ↓ ↓ ← → ← → B A — anywhere on the site. hold on tight.", cls: "dim" }]);
        break;
      default:
        if (isThemeName(head)) {
          applyTheme(head);
          print([{ text: THEME_DIALOGUE[head] ?? `theme enabled: ${head}.`, cls: "accent" }]);
        } else {
          print([{ text: `command not found: ${head}`, cls: "dim" }]);
        }
    }
  }

  function applyTheme(theme: ThemeName | null) {
    const html = document.documentElement;
    if (theme) html.dataset.theme = theme;
    else delete html.dataset.theme;
    try {
      if (theme) localStorage.setItem("bl:theme", theme);
      else localStorage.removeItem("bl:theme");
    } catch { /* ignore */ }
    window.dispatchEvent(new Event("bl:theme-change"));
  }

  if (!open) return null;

  return (
    <div className={styles.termBackdrop} onClick={() => setOpen(false)}>
      <div
        ref={dialogRef}
        className={`${styles.terminal} ${rainbow ? styles.termRainbow : ""}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Lab terminal"
      >
        <div className={styles.termHeader}>
          <span>sam@besleys-lab — /dev/arcade</span>
          <button type="button" className={styles.termClose} onClick={() => setOpen(false)} aria-label="Close terminal">
            ✕
          </button>
        </div>
        <div className={styles.termBody} ref={bodyRef}>
          {lines.map((l, i) => (
            <div key={i} className={l.cls === "dim" ? styles.termDim : l.cls === "accent" ? styles.termAccent : undefined}>
              {l.text}
              {l.artifact && <Image className={styles.termArtifact} src={SECRET_ARTIFACTS[l.artifact].src} alt="" width={60} height={60} />}
            </div>
          ))}
        </div>
        <form
          className={styles.termInputRow}
          onSubmit={(e) => {
            e.preventDefault();
            run(input);
            setInput("");
          }}
        >
          <span aria-hidden>&gt;</span>
          <input
            ref={inputRef}
            className={styles.termInput}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            aria-label="Terminal command"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit" className={styles.termSubmit} aria-label="Run command">
            Run
          </button>
        </form>
      </div>
    </div>
  );
}
