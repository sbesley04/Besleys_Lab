"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import SaveSlot from "../_components/SaveSlot";
import { postResult, recordPlayed, recordWin, unlock } from "@/lib/arcade";
import styles from "../_components/newGame.module.css";
import { CONTRACTS, crossPlants, genotypeLabel, matchingContracts, phenotype, starterPlants, type Plant } from "./engine";

const BED_LIMIT = 14;
interface GardenState { plants: Plant[]; selected: number[]; completed: string[]; crosses: number; nextId: number; assayed: number[]; research: number; mutationRate: number; stableRun?: boolean }
const initialGarden = (): GardenState => ({ plants: starterPlants(), selected: [], completed: [], crosses: 0, nextId: 7, assayed: [], research: 6, mutationRate: 0.05, stableRun: true });

export default function GeneticGarden() {
  const [garden, setGarden] = useState<GardenState>(initialGarden);
  const gardenRef = useRef(garden);
  const reported = useRef(false);
  gardenRef.current = garden;
  useEffect(() => recordPlayed("genetic-garden"), []);

  function select(id: number) {
    setGarden((g) => g.selected.includes(id) ? { ...g, selected: g.selected.filter((n) => n !== id) } : { ...g, selected: [...g.selected.slice(-1), id] });
  }
  function breed() {
    const g = gardenRef.current;
    if (g.selected.length !== 2 || g.plants.length >= BED_LIMIT) return;
    const a = g.plants.find((p) => p.id === g.selected[0]); const b = g.plants.find((p) => p.id === g.selected[1]);
    if (!a || !b) return;
    const child = crossPlants(a, b, g.nextId, Math.random, g.mutationRate);
    const completed = [...new Set([...g.completed, ...matchingContracts(child)])];
    const next = { ...g, plants: [...g.plants, child], selected: [child.id], completed, crosses: g.crosses + 1, nextId: g.nextId + 1, stableRun: (g.stableRun ?? false) && g.mutationRate === 0 };
    setGarden(next);
    if (completed.length === CONTRACTS.length && !reported.current) {
      reported.current = true; recordWin("genetic-garden"); unlock("garden-catalogue");
      if (next.stableRun) unlock("garden-stable");
      postResult({ game: "genetic-garden", event: "win", mode: "advanced-catalogue", score: Math.max(0, 2000 - next.crosses * 35 + g.research * 20), moves: next.crosses, meta: { mutationRate: g.mutationRate } });
    }
  }
  function assay() {
    setGarden((g) => {
      const id = g.selected[0];
      if (g.selected.length !== 1 || g.research <= 0 || g.assayed.includes(id)) return g;
      return { ...g, assayed: [...g.assayed, id], research: g.research - 1 };
    });
  }
  function compost() {
    setGarden((g) => {
      const removable = g.selected.filter((id) => id > 6);
      if (removable.length === 0) return g;
      return { ...g, plants: g.plants.filter((p) => !removable.includes(p.id)), selected: [], assayed: g.assayed.filter((id) => !removable.includes(id)) };
    });
  }
  function restart() { reported.current = false; setGarden(initialGarden()); }
  const oneSelected = garden.selected.length === 1 ? garden.plants.find((p) => p.id === garden.selected[0]) : null;
  const selectionMessage = garden.selected.length === 0 ? "Choose two parent plants." : garden.selected.length === 1 ? "Choose one more parent plant." : "Parents selected; ready to cross.";

  return (
    <div className={styles.stack}>
      <div className={styles.spread}>
        <div><p className={styles.kicker}>Breeding bench · {garden.plants.length}/{BED_LIMIT} beds</p><p className={styles.stat}>{garden.completed.length} / {CONTRACTS.length} commissions</p></div>
        <div><div className={styles.row}><button className={`${styles.button} ${styles.primary}`} disabled={garden.selected.length !== 2 || garden.plants.length >= BED_LIMIT} onClick={breed}>Cross selected</button><button className={styles.button} disabled={!oneSelected || garden.assayed.includes(oneSelected.id) || garden.research <= 0} onClick={assay}>Assay · 1 point</button><button className={styles.button} disabled={!garden.selected.some((id) => id > 6)} onClick={compost}>Compost selected</button><button className={styles.button} onClick={restart}>↻ New garden</button></div><p className={styles.selectionStatus} role="status" aria-live="polite">{selectionMessage}</p></div>
      </div>
      {garden.plants.length >= BED_LIMIT ? <div className={styles.banner} role="status"><h2>Every propagation bed is occupied.</h2><p className={styles.help}>Select one or two non-starter crosses to compost before breeding again.</p></div> : null}
      {garden.completed.length === CONTRACTS.length ? <div className={styles.banner} role="status"><h2>The advanced seed catalogue is complete.</h2><p className={styles.help}>Six phenotypes bred in {garden.crosses} crosses with {garden.research} research points remaining.</p></div> : null}
      <div className={styles.layout}>
        <section className={styles.garden} aria-label="Genetic garden">{garden.plants.map((plant) => <PlantCard key={plant.id} plant={plant} selected={garden.selected.includes(plant.id)} assayed={garden.assayed.includes(plant.id)} onClick={() => select(plant.id)} />)}</section>
        <aside className={styles.sidebar}>
          <div className={styles.panel}><p className={styles.kicker}>Research</p><p className={styles.stat}>{garden.research} assay points</p><label className={styles.control}>Mutation pressure<select className={styles.select} value={garden.mutationRate} onChange={(e) => setGarden((g) => ({ ...g, mutationRate: Number(e.target.value) }))}><option value="0">Stable · 0%</option><option value="0.05">Field · 5%</option><option value="0.12">Wild · 12%</option></select></label>{oneSelected && garden.assayed.includes(oneSelected.id) ? <p className={styles.genome}><strong>{oneSelected.name}</strong><br />{genotypeLabel(oneSelected)}{oneSelected.parents ? <><br />parents #{oneSelected.parents.join(" × #")}</> : null}{oneSelected.mutations ? <><br />{oneSelected.mutations} mutation{oneSelected.mutations === 1 ? "" : "s"}</> : null}</p> : <p className={styles.help}>Phenotypes are visible; genotypes are hidden until assayed.</p>}</div>
          <div className={`${styles.panel} ${styles.contracts}`}><p className={styles.kicker}>Commissions</p>{CONTRACTS.map((contract) => <div key={contract.id} className={`${styles.contract} ${garden.completed.includes(contract.id) ? styles.contractDone : ""}`}><strong>{garden.completed.includes(contract.id) ? "✓ " : contract.tier === 2 ? "◆ " : ""}{contract.title}</strong><div>{contract.description}</div></div>)}</div>
          <div className={styles.panel}><p className={styles.kicker}>Crosses</p><p className={styles.stat}>{garden.crosses}</p></div>
          <p className={styles.help}>Select two parents. Dominant plum pigment can hide white alleles; drought tolerance requires two D alleles. Assays reveal exactly what a plant can pass on.</p>
          <SaveSlot<GardenState> game="genetic-garden" getState={() => gardenRef.current} onLoad={(s) => { reported.current = s.completed.length === CONTRACTS.length; setGarden({ ...s, stableRun: s.stableRun ?? false }); }} validate={isGardenState} />
        </aside>
      </div>
    </div>
  );
}

function PlantCard({ plant, selected, assayed, onClick }: { plant: Plant; selected: boolean; assayed: boolean; onClick: () => void }) {
  const p = phenotype(plant);
  return <button className={`${styles.plant} ${selected ? styles.plantSelected : ""}`} onClick={onClick} aria-pressed={selected}><span className={styles.flower} aria-hidden="true"><span className={styles.stem} style={{ transform: `scaleY(${p.height / 1.8})` }} /><span className={`${styles.flowerHead} ${styles[p.color]}`}>{Array.from({ length: p.petals }, (_, index) => <span key={index} className={styles.petal} style={{ "--petal-angle": `${(360 * index) / p.petals}deg` } as CSSProperties} />)}<span className={styles.flowerCore} /></span></span><span className={styles.plantName}>{plant.name} · F{plant.generation}</span><span className={styles.traits}>{p.color} · {p.petals} petals<br />height {p.height.toFixed(2)} · {p.drought ? "drought hardy" : "needs water"}<br />{assayed ? genotypeLabel(plant) : "genotype unassayed"}</span></button>;
}

const isGardenState = (v: unknown): v is GardenState => { const s = v as GardenState; return !!s && typeof s === "object" && Array.isArray(s.plants) && Array.isArray(s.completed) && Array.isArray(s.assayed) && typeof s.nextId === "number" && typeof s.mutationRate === "number"; };
