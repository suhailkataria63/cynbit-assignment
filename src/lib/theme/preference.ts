export const THEME_KEY = "cynbit.theme";
export type Theme = "light" | "dark";
export function normalizeTheme(value: string | null): Theme {
  return value === "dark" ? "dark" : "light";
}

// Runs synchronously in the document head, before content paints. No user data is interpolated.
export const themeInitScript = `try{document.documentElement.dataset.theme=localStorage.getItem("${THEME_KEY}") === "dark" ? "dark" : "light"}catch{document.documentElement.dataset.theme="light"}`;
