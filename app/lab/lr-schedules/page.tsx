import LabFrame from "../_components/LabFrame";
import LrSchedules from "./LrSchedules";
import { demos } from "../registry";

const meta = demos.find((d) => d.slug === "lr-schedules")!;

export const metadata = { title: meta.title, description: meta.blurb };

export default function Page() {
  return (
    <LabFrame title={meta.title} takeaway={meta.takeaway}>
      <LrSchedules />
    </LabFrame>
  );
}
