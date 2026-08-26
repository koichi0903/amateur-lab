declare module "twitter-text" {
  const twitterText: {
    parseTweet(value: string): { weightedLength: number; valid: boolean };
  };
  export default twitterText;
}
