export const currencies = [
  { code: "INR", label: "INR - Indian Rupee (₹)" },
  { code: "USD", label: "USD - US Dollar ($)" },
  { code: "EUR", label: "EUR - Euro (€)" },
  { code: "GBP", label: "GBP - British Pound (£)" },
  { code: "AED", label: "AED - UAE Dirham (د.إ)" },
  { code: "CAD", label: "CAD - Canadian Dollar (C$)" },
  { code: "AUD", label: "AUD - Australian Dollar (A$)" },
  { code: "SGD", label: "SGD - Singapore Dollar (S$)" },
  { code: "JPY", label: "JPY - Japanese Yen (¥)" },
] as const;
export type Currency = (typeof currencies)[number]["code"];
export const currencyCodes = currencies.map(currency => currency.code) as [Currency, ...Currency[]];

export function parseBudget(budget: string, selected?: Currency) {
  const value = budget.trimStart();
  const match = /^(INR|USD|EUR|GBP|AED|CAD|AUD|SGD|JPY)(?:\s+|$)(.*)$/i.exec(value);
  const amount = /^(?:not sure|unspecified)$/i.test(value.trim()) ? "" : match ? match[2] : value;
  // Never assign a currency to an ambiguous saved legacy amount.
  const currency = selected ?? (match?.[1].toUpperCase() as Currency | undefined) ?? (amount.trim() ? "" : "INR");
  return { currency, amount };
}
export function serializeBudget(budget: string, currency?: Currency) {
  const parsed = parseBudget(budget, currency);
  if (!parsed.amount.trim()) return "";
  return parsed.currency ? `${parsed.currency} ${parsed.amount.trim()}` : parsed.amount.trim();
}
