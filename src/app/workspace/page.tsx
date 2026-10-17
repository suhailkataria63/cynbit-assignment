import type { Metadata } from "next";
import { DiscoveryWorkspace } from "@/components/workspace/discovery-workspace";

export const metadata: Metadata = {
  title: "Discovery Workspace",
  description: "Complete a guided business discovery questionnaire and generate a grounded solution blueprint with Cynbit.",
};

export default function WorkspacePage() {
  return <DiscoveryWorkspace />;
}
