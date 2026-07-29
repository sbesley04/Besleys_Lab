import LabFrame from "../_components/LabFrame";
import GradientDescent from "./GradientDescent";
import { demos } from "../registry";

const meta = demos.find((d) => d.slug === "gradient-descent")!;

export const metadata = { title: meta.title, description: meta.blurb };

export default function Page() {
  return (
    <LabFrame title={meta.title} takeaway={meta.takeaway}>
      <GradientDescent />
    </LabFrame>
  );
}
