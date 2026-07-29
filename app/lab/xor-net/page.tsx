import LabFrame from "../_components/LabFrame";
import XorNet from "./XorNet";
import { demos } from "../registry";

const meta = demos.find((d) => d.slug === "xor-net")!;

export const metadata = { title: meta.title, description: meta.blurb };

export default function Page() {
  return (
    <LabFrame title={meta.title} takeaway={meta.takeaway}>
      <XorNet />
    </LabFrame>
  );
}
