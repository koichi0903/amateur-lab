export function text(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").normalize("NFKC").trim();
}

export function intValue(formData: FormData, name: string) {
  const value = Number(text(formData, name).replace(/[^\d.-]/g, ""));
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

export function numberValue(formData: FormData, name: string) {
  const value = Number(text(formData, name).replace(/[^\d.-]/g, ""));
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function nullableId(formData: FormData, name: string) {
  const value = intValue(formData, name);
  return value > 0 ? value : null;
}
