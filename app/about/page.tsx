import Link from "next/link";
import Snapshot from "../_components/Snapshot";

import portrait from "@/public/photos/portrait.jpg";
import samAndDonkey from "@/public/photos/sam-and-donkey.jpg";
import graduation from "@/public/photos/graduation.jpg";
import riverBoat from "@/public/photos/river-boat.jpg";
import octopusVase from "@/public/photos/octopus-vase.jpg";
import mountainGoats from "@/public/photos/mountain-goats.jpg";
import farmCat from "@/public/photos/farm-cat.jpg";
import barnCrew from "@/public/photos/barn-crew.jpg";
import aquarium from "@/public/photos/aquarium.jpg";

// Static bio with photos taped in. EXTEND HERE: pull from a CMS or markdown
// file if it grows; add new gallery entries to the `gallery` array below.
export const metadata = {
  title: "About",
  description:
    "Samuel Besley — data scientist and full-stack developer from Emory University. NLP pipelines, machine learning, and the occasional arcade game.",
};

const gallery = [
  { src: samAndDonkey, alt: "Sam smiling while petting a donkey inside the barn", caption: "quality control at the barn", tilt: -2 },
  { src: graduation, alt: "Six graduates in gowns posed on marble steps", caption: "graduation day at Emory", tilt: 1.5 },
  { src: riverBoat, alt: "Friends in a small motorboat under a railroad bridge", caption: "the trusty vessel", tilt: -1.5 },
  { src: octopusVase, alt: "A handmade ceramic vase covered in octopus tentacles", caption: "a ceramics detour", tilt: 2 },
  { src: mountainGoats, alt: "Two mountain goats on a rocky slope near the snow line", caption: "hiking company", tilt: -1 },
  { src: farmCat, alt: "A fluffy gray cat sitting in the grass", caption: "senior barn cat", tilt: 1.5 },
  { src: barnCrew, alt: "Two people flexing and laughing in front of the barn", caption: "farm crew", tilt: -2 },
  { src: aquarium, alt: "Two people sitting in front of a glowing aquarium tank", caption: "field trip", tilt: 1 },
];

export default function AboutPage() {
  return (
    <main style={{ maxWidth: 880, margin: "0 auto", padding: "3.5rem 1.5rem" }}>
      <Link href="/" style={{ fontSize: "0.9rem" }}>
        ← Home
      </Link>

      {/* --- Bio beside the portrait --- */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
          gap: "clamp(2rem, 5vw, 3rem)",
          alignItems: "start",
          marginTop: "0.5rem",
        }}
      >
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "2.6rem", margin: "0 0 1.25rem" }}>
            About
          </h1>
          <div style={{ fontSize: "1.05rem", color: "var(--ink)" }}>
            <p>
              Hi there! Welcome in. I&rsquo;m Sam — a data/quantitative science student from Emory
              (class of &rsquo;26), living in Atlanta.
            </p>
            <p>
              My work so far has lived where machine learning meets things people can actually use:
              NLP pipelines with transformer models, prediction models with carefully
              engineered features, and the full-stack apps that put them on a screen. The{" "}
              <Link href="/projects">projects shelf</Link> has the highlights — including a
              document-analysis dashboard live on Vercel — and the{" "}
              <Link href="/blog">blog</Link> is where I write up what I&rsquo;m learning along
              the way.
            </p>
            <p>
              This site is part notebook, part workshop. The <Link href="/games">arcade</Link>{" "}
              holds the experiments that exist mostly because they were fun to build — try the
              Hunger Games simulator with your own friends as tributes.
            </p>
            <p>
              When the laptop is closed, I&rsquo;m usually somewhere in the photos below — on a
              volleyball court (eight years of it, plus a stint as club president and volunteer
              coach), behind a camera (once for Emory&rsquo;s communications team, now mostly for
              the donkeys), trying my hand at ceramics, or reading (for one of my book clubs).
            </p>
            <p style={{ fontSize: "0.95rem" }}>
              Looking for the formal version? Here&rsquo;s my{" "}
              <Link href="/resume">resume</Link> — or just <Link href="/contact">say hi</Link>.
            </p>
          </div>
        </div>

        <div style={{ maxWidth: 320, justifySelf: "center", padding: "0.75rem 0.25rem 0" }}>
          <Snapshot
            src={portrait}
            alt="Sam sitting on a rock in front of a barn, smiling"
            caption="hi, I'm Sam"
            tilt={2}
            aspect="3 / 4"
            sizes="(max-width: 720px) 80vw, 320px"
            priority
          />
        </div>
      </div>

      {/* --- Gallery: life beyond the keyboard --- */}
      <section aria-label="Photo gallery" style={{ marginTop: "clamp(2.5rem, 6vw, 4rem)" }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.75rem", marginBottom: "0.15rem" }}>
          Beyond the keyboard
        </h2>
        <p style={{ color: "var(--ink-soft)", fontSize: "0.95rem", marginBottom: "1.75rem" }}>
          A few frames from the parts of life that don&rsquo;t compile.
        </p>
        <div className="photo-grid">
          {gallery.map((photo) => (
            <Snapshot
              key={photo.caption}
              src={photo.src}
              alt={photo.alt}
              caption={photo.caption}
              tilt={photo.tilt}
              aspect="4 / 5"
              sizes="(max-width: 720px) 45vw, 220px"
            />
          ))}
        </div>
      </section>
    </main>
  );
}
