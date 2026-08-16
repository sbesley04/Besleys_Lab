"use client";

import { useEffect, useState } from "react";
import { postResult, recordPlayed, recordWin, unlock } from "@/lib/arcade";
import styles from "../_components/newGame.module.css";
import { CASES, DETECTIVE_MODES, clueCost, initialBeliefs, updateBeliefs, type DetectiveDifficulty } from "./engine";

export default function BayesianDetective() {
  const [caseIndex, setCaseIndex] = useState(0);
  const [difficulty, setDifficulty] = useState<DetectiveDifficulty>("detective");
  const current = CASES[caseIndex];
  const [beliefs, setBeliefs] = useState(() => initialBeliefs(CASES[0]));
  const [used, setUsed] = useState<string[]>([]);
  const [budget, setBudget] = useState(DETECTIVE_MODES.detective.budget);
  const [lastShift, setLastShift] = useState<Record<string, number>>({});
  const [outcome, setOutcome] = useState<null | { correct: boolean; suspect: string }>(null);
  useEffect(() => recordPlayed("bayesian-detective"), []);

  function investigate(clueId: string) {
    const clue = current.clues.find((c) => c.id === clueId)!;
    const cost = clueCost(clue, difficulty);
    if (used.includes(clueId) || budget < cost || outcome) return;
    const next = updateBeliefs(beliefs, clue);
    setLastShift(Object.fromEntries(current.suspects.map((s) => [s.id, next[s.id] - beliefs[s.id]])));
    setBeliefs(next); setUsed([...used, clueId]); setBudget(budget - cost);
  }
  function accuse(suspect: string) {
    if (outcome) return;
    const correct = suspect === current.culprit;
    setOutcome({ correct, suspect });
    if (correct) {
      recordWin("bayesian-detective"); if (budget >= 50) unlock("bayes-frugal");
      if (difficulty === "cold") unlock("bayes-cold");
      postResult({ game: "bayesian-detective", event: "win", mode: `${difficulty}-${current.id}`, score: budget, moves: used.length, meta: { confidence: beliefs[suspect] } });
    }
  }
  function loadCase(index: number, mode = difficulty) {
    const next = CASES[index];
    setCaseIndex(index); setDifficulty(mode); setBeliefs(initialBeliefs(next)); setUsed([]);
    setBudget(DETECTIVE_MODES[mode].budget); setLastShift({}); setOutcome(null);
  }

  const showNumbers = difficulty !== "cold" || used.length >= 2;
  const latestClue = current.clues.find((clue) => clue.id === used[used.length - 1]);
  return (
    <div className={styles.stack}>
      <div className={styles.spread}>
        <div><p className={styles.kicker}>Case {caseIndex + 1} of {CASES.length}</p><p className={styles.stat}>{current.title}</p></div>
        <div className={styles.row}><label className={styles.control}>Investigation<select className={styles.select} value={difficulty} onChange={(e) => loadCase(caseIndex, e.target.value as DetectiveDifficulty)}>{(Object.keys(DETECTIVE_MODES) as DetectiveDifficulty[]).map((key) => <option key={key} value={key}>{DETECTIVE_MODES[key].label}</option>)}</select></label><div className={styles.row} role="group" aria-label="Choose a case">{CASES.map((c, i) => <button key={c.id} aria-label={`Load case ${i + 1}: ${c.title}`} aria-pressed={i === caseIndex} className={`${styles.button} ${i === caseIndex ? styles.buttonActive : ""}`} onClick={() => loadCase(i)}>{i + 1}</button>)}</div></div>
      </div>
      <div className={styles.banner}><p className={styles.help}>{current.setup} {difficulty === "cold" ? "Priors remain sealed until two findings are logged." : "Every test spends inquiry points, and you get one accusation."}</p></div>
      {outcome ? <div className={styles.banner} role={outcome.correct ? "status" : "alert"}><h2>{outcome.correct ? "Case closed." : "The accusation does not hold."}</h2><p className={styles.help}>{outcome.correct ? `Correct, with ${budget} inquiry points left and ${(beliefs[outcome.suspect] * 100).toFixed(1)}% posterior confidence.` : `The culprit was ${current.suspects.find((s) => s.id === current.culprit)!.name}. Review which clues actually distinguished the alternatives.`}</p></div> : null}
      <p className={styles.srOnly} aria-live="polite">{latestClue ? `${latestClue.finding} ${budget} inquiry points remain.` : ""}</p>
      <div className={styles.layout}>
        <section className={styles.stack}>
          <div className={styles.suspects}>{current.suspects.map((suspect) => {
            const shift = lastShift[suspect.id] ?? 0;
            const shiftLabel = Math.abs(shift) < 0.0005 ? "No change from latest evidence" : `${shift > 0 ? "+" : ""}${(shift * 100).toFixed(1)} points from latest evidence`;
            return <article className={styles.suspect} key={suspect.id}><div className={styles.suspectTop}><h3>{suspect.name}</h3><span>{showNumbers ? `${(beliefs[suspect.id] * 100).toFixed(1)}%` : "SEALED"}</span></div>{showNumbers ? <div className={styles.meter} role="progressbar" aria-label={`Posterior probability for ${suspect.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Number((beliefs[suspect.id] * 100).toFixed(1))}><span style={{ width: `${beliefs[suspect.id] * 100}%` }} /></div> : null}<p className={styles.help}>{suspect.note}</p>{used.length > 0 && showNumbers ? <p className={`${styles.shift} ${shift > 0 ? styles.shiftUp : styles.shiftDown}`}>{shiftLabel}</p> : null}<button className={styles.button} aria-label={`Accuse ${suspect.name}`} disabled={!!outcome} onClick={() => accuse(suspect.id)}>Accuse</button></article>;
          })}</div>
          <p className={styles.help}>Look for evidence with very different likelihoods across suspects. Expensive evidence is not automatically useful; diagnostic spread is what moves the posterior.</p>
        </section>
        <aside className={styles.sidebar}>
          <div className={styles.panel}><p className={styles.kicker}>Inquiry budget</p><p className={styles.stat} aria-live="polite">{budget}</p><div className={styles.meter} role="progressbar" aria-label="Inquiry points remaining" aria-valuemin={0} aria-valuemax={DETECTIVE_MODES[difficulty].budget} aria-valuenow={budget}><span style={{ width: `${(budget / DETECTIVE_MODES[difficulty].budget) * 100}%` }} /></div></div>
          <div className={styles.clues}>{current.clues.map((clue) => { const found = used.includes(clue.id); const cost = clueCost(clue, difficulty); const shortfall = Math.max(0, cost - budget); const likelihoods = Object.values(clue.likelihood); const spread = Math.max(...likelihoods) / Math.max(0.01, Math.min(...likelihoods)); return <button key={clue.id} className={`${styles.clue} ${found ? styles.clueFound : ""}`} disabled={found || shortfall > 0 || !!outcome} onClick={() => investigate(clue.id)}><strong>{clue.label}</strong> · {cost}{DETECTIVE_MODES[difficulty].revealLikelihoods && !found ? <small>Diagnostic spread: {spread.toFixed(1)}×</small> : null}{found ? <small>{clue.finding}</small> : shortfall > 0 ? <small>Need {shortfall} more inquiry point{shortfall === 1 ? "" : "s"}.</small> : null}</button>; })}</div>
        </aside>
      </div>
    </div>
  );
}
