import LabFrame from "../_components/LabFrame";
import SVM from "./SVM";
import { demos } from "../registry";

const meta = demos.find((d) => d.slug === "svm")!;

export const metadata = { title: meta.title, description: meta.blurb };

export default function Page() {
  return (
    <LabFrame title={meta.title} takeaway={meta.takeaway}>
      <SVM />
    </LabFrame>
  );
}
