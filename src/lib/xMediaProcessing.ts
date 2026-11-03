export type XMediaProcessingInfo = {
  state?: string;
  check_after_secs?: number;
};

export async function waitForXMediaProcessing(
  initial: XMediaProcessingInfo | undefined,
  fetchStatus: () => Promise<XMediaProcessingInfo | undefined>,
  wait: (milliseconds: number) => Promise<void>,
): Promise<void> {
  let processing = initial;
  for (let attempt = 0; processing?.state && processing.state !== "succeeded"; attempt += 1) {
    if (processing.state === "failed") throw new Error("X media processing failed.");
    if (attempt >= 12) throw new Error("X media processing did not finish in time.");
    await wait(Math.max(processing.check_after_secs ?? 2, 1) * 1000);
    processing = await fetchStatus();
  }
}
