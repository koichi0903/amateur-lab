export function myfansTextBigrams(text: string) {
  const grams = new Set<string>();
  for (let index = 0; index < Math.max(1, text.length - 1); index += 1) {
    grams.add(text.slice(index, index + 2));
  }
  return grams;
}
