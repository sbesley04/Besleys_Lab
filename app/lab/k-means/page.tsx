import LabFrame from "../_components/LabFrame";
import KMeans from "./KMeans";
import { demos } from "../registry";

const meta = demos.find((d) => d.slug === "k-means")!;

export const metadata = { title: meta.title, description: meta.blurb };

export default function Page() {
  return (
    <LabFrame title={meta.title} takeaway={meta.takeaway}>
      <KMeans />
    </LabFrame>
  );
}
