import twitterText from "twitter-text";

export function getXWeightedLength(value: string) {
  return twitterText.parseTweet(value).weightedLength;
}

export function truncateXText(value: string, maxWeight: number) {
  if (getXWeightedLength(value) <= maxWeight) return value;
  const characters = Array.from(value);
  while (characters.length && getXWeightedLength(`${characters.join("")}…`) > maxWeight) characters.pop();
  return `${characters.join("")}…`;
}
