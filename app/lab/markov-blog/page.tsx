import LabFrame from "../_components/LabFrame";
import MarkovBlog from "./MarkovBlog";
import { FALLBACK_CORPUS } from "./engine";
import { demos } from "../registry";
import { prisma } from "@/lib/prisma";

const meta = demos.find((d) => d.slug === "markov-blog")!;

export const metadata = { title: meta.title, description: meta.blurb };

// The corpus is this site's own published posts, read at request time so new
// writing feeds the model automatically. A DB hiccup (or an empty blog) falls
// back to a small built-in corpus rather than breaking the page.
export const dynamic = "force-dynamic";

const MIN_WORDS = 120;

export default async function Page() {
  const posts = await prisma.post
    .findMany({
      where: { published: true },
      select: { title: true, body: true },
      orderBy: { publishedAt: "desc" },
      take: 50,
    })
    .catch(() => []);

  const joined = posts.map((p) => `${p.title}. ${p.body}`).join("\n\n");
  const enough = joined.split(/\s+/).filter(Boolean).length >= MIN_WORDS;
  const corpus = enough ? joined : FALLBACK_CORPUS;

  return (
    <LabFrame title={meta.title} takeaway={meta.takeaway}>
      <MarkovBlog corpus={corpus} postCount={posts.length} usingFallback={!enough} />
    </LabFrame>
  );
}
