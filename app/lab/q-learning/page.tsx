import LabFrame from "../_components/LabFrame";
import QLearning from "./QLearning";
import { demos } from "../registry";

const meta = demos.find((d) => d.slug === "q-learning")!;

export const metadata = { title: meta.title, description: meta.blurb };

export default function Page() {
  return (
    <LabFrame title={meta.title} takeaway={meta.takeaway}>
      <QLearning />
    </LabFrame>
  );
}
