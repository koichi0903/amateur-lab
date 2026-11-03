import type { MyfansProduct, MyfansQuoteCandidate } from "@/lib/myfansAnalytics";
import type { MyfansTopicValue } from "@/lib/myfans/myfansQuotePool";
import type { MyfansCreativeStrategy, MyfansLinkStrategy } from "@/lib/myfansXExecution";

export type MyfansPublicCopyQualityInput = {
  body: string;
  product: MyfansProduct;
  postType: string;
  linkStrategy: MyfansLinkStrategy;
  creativeStrategy: MyfansCreativeStrategy;
  quote: MyfansQuoteCandidate | null;
  topicValue?: MyfansTopicValue | null;
};
