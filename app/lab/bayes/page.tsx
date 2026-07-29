import LabFrame from "../_components/LabFrame";
import Bayes from "./Bayes";
import { demos } from "../registry";

const meta = demos.find((d) => d.slug === "bayes")!;

export const metadata = { title: meta.title, description: meta.blurb };

export default function Page() {
  return (
    <LabFrame title={meta.title} takeaway={meta.takeaway}>
      <Bayes />
    </LabFrame>
  );
}
