import LabFrame from "../_components/LabFrame";
import MarkovBlog from "./MarkovBlog";
import { FALLBACK_CORPUS } from "./engine";
import { demos } from "../registry";
import { prisma } from "@/lib/prisma";

const meta = demos.find((d) => d.slug === "markov-blog")!;

export const metadata = { title: meta.title, description: meta.blurb };

// Refresh the corpus regularly without making every lab visit wait on a fresh
// database query. A DB hiccup (or an empty blog) still falls back gracefully.
export const revalidate = 300;

const MIN_WORDS = 120;
const MAX_CORPUS_CHARS = 80_000;

export default async function Page() {
  const posts = await prisma.post
    .findMany({
      where: { published: true },
      select: { title: true, body: true },
      orderBy: { publishedAt: "desc" },
      take: 50,
    })
    .catch(() => []);

  // Keep the interactive client payload bounded if the archive grows large.
  const joined = posts.map((p) => `${p.title}. ${p.body}`).join("\n\n").slice(0, MAX_CORPUS_CHARS);
  const enough = joined.split(/\s+/).filter(Boolean).length >= MIN_WORDS;
  const corpus = enough ? joined : FALLBACK_CORPUS;

  return (
    <LabFrame title={meta.title} takeaway={meta.takeaway}>
      <MarkovBlog corpus={corpus} postCount={posts.length} usingFallback={!enough} />
    </LabFrame>
  );
}
