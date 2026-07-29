import LabFrame from "../_components/LabFrame";
import Regression from "./Regression";
import { demos } from "../registry";

const meta = demos.find((d) => d.slug === "regression")!;

export const metadata = { title: meta.title, description: meta.blurb };

export default function Page() {
  return (
    <LabFrame title={meta.title} takeaway={meta.takeaway}>
      <Regression />
    </LabFrame>
  );
}
