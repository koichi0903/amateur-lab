export type Message = { text: string; error: boolean } | null;

export const inputClass = "h-11 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-white outline-none focus:border-emerald-500";

export function StatusMessage({ message }: { message: Message }) {
  if (!message) return null;
  return <p className={`text-sm ${message.error ? "text-red-300" : "text-emerald-300"}`}>{message.text}</p>;
}
