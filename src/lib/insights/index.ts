import { InsightGenerator } from "./generator";
import { PriceDropRule } from "./rules/priceDrop";
import { LowestPriceRule } from "./rules/lowestPrice";
import { TrendingRule } from "./rules/trending";

export const insightGenerator = new InsightGenerator([
  new PriceDropRule(),
  new LowestPriceRule(),
  new TrendingRule(),
]);