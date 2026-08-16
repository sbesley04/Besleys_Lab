"use client";

import styles from "../lab.module.css";

// Shared control widgets: labelled sliders, button rows, mode pickers, and the
// play/step/reset transport every training demo needs.

export function Slider({
  label,
  value,
  onChange,
  min,
  max,
  step = 0.01,
  format = (v: number) => String(v),
  disabled = false,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  format?: (v: number) => string;
  disabled?: boolean;
}) {
  return (
    <label className={styles.slider}>
      <span className={styles.sliderLabel}>{label}</span>
      <span className={styles.sliderValue}>{format(value)}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={format(value)}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

export function Button({
  children,
  onClick,
  active,
  disabled = false,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  /** Pass a boolean for toggle/choice buttons; omit for one-shot actions. */
  active?: boolean;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      className={`${styles.button} ${active ? styles.buttonActive : ""}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

/** A row of mutually-exclusive options. */
export function Picker<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className={styles.controls} role="group" aria-label={label}>
      {options.map((o) => (
        <Button key={o.value} active={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </Button>
      ))}
    </div>
  );
}

/** Play / pause, single step, and reset — the transport for training loops. */
export function Transport({
  running,
  onToggle,
  onStep,
  onReset,
  stepLabel = "Step",
  disabled = false,
}: {
  running: boolean;
  onToggle: () => void;
  onStep: () => void;
  onReset: () => void;
  stepLabel?: string;
  disabled?: boolean;
}) {
  return (
    <div className={styles.controls} role="group" aria-label="Animation controls">
      <Button onClick={onToggle} disabled={disabled}>
        <span aria-hidden>{running ? "⏸" : "▶"}</span>&nbsp;{running ? "Pause" : "Run"}
      </Button>
      <Button onClick={onStep} disabled={disabled || running}>
        <span aria-hidden>⏭</span>&nbsp;{stepLabel}
      </Button>
      <Button onClick={onReset} disabled={disabled}>
        <span aria-hidden>↻</span>&nbsp;Reset
      </Button>
    </div>
  );
}

export function Readout({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <span className={styles.readoutItem}>
      {label} <span className={styles.readoutValue}>{value}</span>
    </span>
  );
}

export function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <ul className={styles.legend} aria-label="Chart legend">
      {items.map((i) => (
        <li key={i.label} className={styles.legendItem}>
          <span className={styles.swatch} style={{ background: i.color }} aria-hidden />
          {i.label}
        </li>
      ))}
    </ul>
  );
}
