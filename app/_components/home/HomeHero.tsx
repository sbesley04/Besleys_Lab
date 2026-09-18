"use client";

import { useRef, type ReactNode } from "react";
import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import {
  MotionConfig,
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";
import GridText from "../eggs/GridText";
import styles from "@/app/home.module.css";

// The home hero: a pinned portrait on the right and a column of "beats" about
// the site on the left that scrolls past it. `position: sticky` does the
// pinning (CSS only, so it works with JS off); `motion` adds a slow drift and
// scale to the portrait as the section scrolls, and fades each beat in.
//
// Scroll-linked values only update while scrolling, so nothing ticks in a
// background tab and no html.bl-idle rule is needed. MotionConfig
// reducedMotion="user" disables the transform reveals for reduced-motion
// users; the parallax is gated on useReducedMotion() explicitly. The
// <noscript> style keeps the beats visible when JS never runs, since
// `initial` is server-rendered as inline opacity: 0.

export type HeroStats = { games: number; demos: number; posts: number; books: number };

type Props = { portrait: StaticImageData; stats: HeroStats };

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

export default function HomeHero({ portrait, stats }: Props) {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  // Direct mapping, no spring: a pinned element with spring lag reads as detached.
  const drift = useTransform(scrollYProgress, [0, 1], [0, -64]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.05]);

  const inside = [
    {
      href: "/projects",
      title: "Projects",
      meta: "Featured work",
      blurb: "Writeups of ML and full-stack projects — stacks, screenshots, and source.",
    },
    {
      href: "/lab",
      title: "Lab",
      meta: plural(stats.demos, "interactive demo", "interactive demos"),
      blurb: "Machine-learning concepts rebuilt as things you can poke at in the browser.",
    },
    {
      href: "/blog",
      title: "Blog",
      meta: stats.posts > 0 ? plural(stats.posts, "post", "posts") : "Notes",
      blurb: "Notes on data, models, and building things.",
    },
    {
      href: "/games",
      title: "Games",
      meta: plural(stats.games, "game", "games"),
      blurb: "A hand-built arcade, including the Hunger Games simulator.",
    },
    {
      href: "/library",
      title: "Library",
      meta: stats.books > 0 ? plural(stats.books, "book", "books") : "Bookshelf",
      blurb: "A digital bookshelf: what I’m reading, with reviews.",
    },
  ];

  return (
    <MotionConfig reducedMotion="user">
      <section ref={ref} className={styles.hero} aria-labelledby="hero-title">
        <noscript>
          <style>{`[data-reveal]{opacity:1!important;transform:none!important}`}</style>
        </noscript>

        <div className={styles.heroText}>
          {/* Above the fold: no entrance animation, so the LCP text is never hidden. */}
          <div className={styles.beat}>
            <p className={styles.kicker}>
              <GridText
                paper="Data scientist & full-stack developer"
                grid="PROGRAM // BESLEY-1 · ACTIVE ON THE GRID"
              />
            </p>
            <h1 id="hero-title" className={styles.title}>
              Besley&rsquo;s Lab
            </h1>
            <p className={styles.lede}>
              <GridText
                paper="Machine-learning projects, interactive demos, and writing on data — plus a small arcade. All built by hand."
                grid="You’re on the Grid now. Everything still runs — it just runs brighter."
              />
            </p>
            <div className={styles.actions}>
              <Link href="/projects" className="button-primary">
                <GridText paper="Explore my work" grid="Access my work" /> <span aria-hidden="true">→</span>
              </Link>
              <Link href="/lab" className="button-secondary">
                <GridText paper="Try an ML demo" grid="Run a demo" />
              </Link>
            </div>
            <ul className={styles.links} aria-label="Profiles">
              <li>
                <a href="https://github.com/sbesley04" target="_blank" rel="noopener noreferrer">
                  GitHub<span aria-hidden="true"> ↗</span>
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </li>
              <li>
                <a href="https://linkedin.com/in/sbesley" target="_blank" rel="noopener noreferrer">
                  LinkedIn<span aria-hidden="true"> ↗</span>
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </li>
              <li>
                <Link href="/resume">Résumé</Link>
              </li>
            </ul>
          </div>

          <Beat index="01" title="What’s inside">
            <ul className={styles.list}>
              {inside.map((s) => (
                <li key={s.href}>
                  <Link href={s.href} className={styles.row}>
                    <span className={styles.rowTitle}>{s.title}</span>
                    <span className={styles.rowMeta}>{s.meta}</span>
                    <span className={styles.rowBlurb}>{s.blurb}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Beat>

          <Beat index="02" title="What I do">
            <ul className={styles.focus}>
              <li className={styles.focusItem}>
                <h3>Machine learning &amp; NLP</h3>
                <p>
                  Transformer pipelines, feature-engineered prediction models, and the evaluation
                  work to know when they actually help.
                </p>
              </li>
              <li className={styles.focusItem}>
                <h3>Full-stack engineering</h3>
                <p>
                  Next.js, TypeScript, and Prisma apps that put models on a screen — this site
                  included, down to the arcade and the admin.
                </p>
              </li>
              <li className={styles.focusItem}>
                <h3>Data &amp; analytics</h3>
                <p>
                  Python, SQL, and R, from raw corpus to a dashboard someone can use without a
                  walkthrough.
                </p>
              </li>
            </ul>
            <p className={styles.note}>
              Data &amp; quantitative science, Emory University &rsquo;26 · Atlanta, GA
            </p>
          </Beat>

          <Beat index="03" title="Get in touch">
            <p className={styles.lede}>
              Open to data science and ML engineering roles, collaborations, and good conversations
              about models. The inbox is the fastest way to reach me.
            </p>
            <div className={styles.actions}>
              <a href="mailto:sambesley04@gmail.com" className="button-primary">
                Email me
              </a>
              <Link href="/about" className="button-secondary">
                More about me
              </Link>
            </div>
          </Beat>
        </div>

        <div className={styles.heroMedia}>
          <div className={styles.heroSticky}>
            <motion.div className={styles.portraitFrame} style={reduce ? undefined : { y: drift, scale }}>
              <Image
                src={portrait}
                alt="Sam, wearing glasses and a navy henley, standing with arms crossed in a field in front of a barn"
                fill
                sizes="(max-width: 860px) 100vw, 40vw"
                preload
                placeholder="blur"
                style={{ objectFit: "cover", objectPosition: "50% 18%" }}
              />
            </motion.div>
            <p className={styles.mediaCaption}>
              <span>Samuel Besley</span>
              <span>Atlanta, GA</span>
            </p>
          </div>
        </div>
      </section>
    </MotionConfig>
  );
}

function Beat({ index, title, children }: { index: string; title: string; children: ReactNode }) {
  return (
    <motion.div
      className={styles.beat}
      data-reveal
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.7, ease: EASE }}
    >
      <p className={styles.beatIndex} aria-hidden="true">
        {index}
      </p>
      <h2 className={styles.beatTitle}>{title}</h2>
      {children}
    </motion.div>
  );
}
