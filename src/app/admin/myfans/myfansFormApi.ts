export async function postFormData(formData: FormData) {
  const response = await fetch("/api/admin/myfans", { method: "POST", body: formData });
  const payload = (await response.json()) as { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "保存に失敗しました。");
}
