export type MyfansStrategyType = "SOURCE" | "MARKET_WINNER";

export type MyfansStrategyConfig = {
  accountId: number;
  handle: string;
  label: string;
  description: string;
  strategyType: MyfansStrategyType;
};

const STRATEGIES: Record<number, MyfansStrategyConfig> = {
  1: { accountId: 1, handle: "@lumi_reviw", label: "Source Strategy", description: "現行のSource Candidate戦略", strategyType: "SOURCE" },
  5: { accountId: 5, handle: "@fansmy230", label: "Market Winner Strategy", description: "Pattern × Source × Productの仮説検証", strategyType: "MARKET_WINNER" },
};

export function getMyfansStrategy(accountId: number | null | undefined): MyfansStrategyConfig {
  return STRATEGIES[accountId ?? 0] ?? { accountId: accountId ?? 0, handle: "", label: "MyFans Strategy", description: "アカウント別運用", strategyType: "SOURCE" };
}

export const MARKET_PATTERN_KEYS = [
  "QUOTE_HOOK", "PRICE_DROP", "LIMITED_WINDOW", "CREATOR_DISCOVERY", "COMPARISON",
  "NEW_RELEASE", "SOCIAL_PROOF", "CURIOSITY_GAP", "FOLLOW_SERIES",
] as const;
