import { createBlueprintHandler } from "@/lib/blueprint/handler";

export const runtime = "nodejs";
export const maxDuration = 60;
export const POST = createBlueprintHandler();
