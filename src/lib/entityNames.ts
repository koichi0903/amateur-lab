export function splitEntityNames(value: string | null) {
  return [...new Set((value ?? "").split(/\s*\/\s*|\s*／\s*|\s*,\s*|\s*、\s*/).map((name) => name.trim()).filter(Boolean))];
}
