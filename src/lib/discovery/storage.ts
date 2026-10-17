import { z } from "zod";
import { blueprintResultSchema, generationDetailsSchema } from "../blueprint/schema";
import { draftSchema, emptyAnswers } from "./questionnaire";

export const SESSION_KEY = "cynbit.discovery.v3";
export const BUDGET_KEY = "cynbit.attempts.v3";
export const DAILY_LIMIT = (() => {
  const value = Number(process.env.NEXT_PUBLIC_BLUEPRINT_DAILY_LIMIT ?? 12);
  return Number.isInteger(value) && value > 0 && value <= 1000 ? value : 12;
})();
export const sessionSchema = z.strictObject({ version: z.literal(3), id: z.uuid(), answers: draftSchema, step: z.number().int().min(0).max(3), result: blueprintResultSchema.nullable(), lastGeneration: generationDetailsSchema.optional(), view: z.enum(["questionnaire", "results"]) });
export type DiscoverySession = z.infer<typeof sessionSchema>;
export interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
export function freshSession(): DiscoverySession {
  return { version: 3, id: crypto.randomUUID(), answers: structuredClone(emptyAnswers), step: 0, result: null, view: "questionnaire" };
}
export function readSession(storage: StorageLike): DiscoverySession | null {
  const raw = storage.getItem(SESSION_KEY);
  if (!raw) return null;
  return sessionSchema.parse(JSON.parse(raw));
}
export function saveSession(storage: StorageLike, session: DiscoverySession) {
  storage.setItem(SESSION_KEY, JSON.stringify(session));
}
function dateKey(date: Date) { return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`; }
const budgetSchema = z.strictObject({ date: z.string(), count: z.number().int().min(0).max(100000) });
export function readBudget(storage: StorageLike, date = new Date()): number {
  const raw = storage.getItem(BUDGET_KEY);
  if (!raw) return 0;
  // Corrupt usage records fail closed instead of silently resetting quota.
  const record = budgetSchema.parse(JSON.parse(raw));
  return record.date === dateKey(date) ? record.count : 0;
}
export function reserveAttempt(storage: StorageLike, date = new Date(), limit = DAILY_LIMIT) {
  const count = readBudget(storage, date);
  if (count >= limit) throw new Error("Your daily testing budget is used up. Your answers are saved. Try again tomorrow.");
  storage.setItem(BUDGET_KEY, JSON.stringify({ date: dateKey(date), count: count + 1 }));
  return count + 1;
}
