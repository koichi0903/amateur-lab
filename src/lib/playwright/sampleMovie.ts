import type { Page, Response } from "playwright-core";

const SAMPLE_MOVIE_WAIT_MS = 15_000;
const SAMPLE_MOVIE_POLL_MS = 250;

export function isSampleMovieUrl(value: string | null | undefined): value is string {
  return Boolean(value && /^https?:/i.test(value) && /\.mp4(?:$|[?#])/i.test(value));
}

async function findMovieUrlInFrames(page: Page): Promise<string | null> {
  for (const frame of page.frames()) {
    const movieUrl = await frame
      .evaluate(() => {
        const videos = Array.from(document.querySelectorAll("video"));
        const candidates = [
          ...videos.flatMap((video) => [
            video.currentSrc,
            video.getAttribute("src"),
          ]),
          ...Array.from(document.querySelectorAll("video source"), (source) =>
            source.getAttribute("src"),
          ),
        ];

        for (const video of videos) {
          if (video.paused) void video.play().catch(() => undefined);
        }

        for (const candidate of candidates) {
          if (!candidate) continue;
          try {
            const absoluteUrl = new URL(candidate, document.baseURI).href;
            if (/^https?:/i.test(absoluteUrl) && /\.mp4(?:$|[?#])/i.test(absoluteUrl)) {
              return absoluteUrl;
            }
          } catch {
            // Ignore malformed media URLs and continue checking other sources.
          }
        }

        return null;
      })
      .catch(() => null);

    if (isSampleMovieUrl(movieUrl)) return movieUrl;
  }

  return null;
}

export function watchSampleMovie(page: Page) {
  let detectedUrl: string | null = null;
  let resolveDetected: ((url: string) => void) | null = null;
  const detected = new Promise<string>((resolve) => {
    resolveDetected = resolve;
  });

  const onResponse = (response: Response) => {
    const responseUrl = response.url();
    if (!detectedUrl && isSampleMovieUrl(responseUrl)) {
      detectedUrl = responseUrl;
      resolveDetected?.(responseUrl);
    }
  };

  page.on("response", onResponse);

  return {
    async waitForUrl(timeoutMs = SAMPLE_MOVIE_WAIT_MS): Promise<string | null> {
      const deadline = Date.now() + timeoutMs;

      while (Date.now() < deadline) {
        if (detectedUrl) return detectedUrl;

        const frameUrl = await findMovieUrlInFrames(page);
        if (frameUrl) {
          detectedUrl = frameUrl;
          resolveDetected?.(frameUrl);
          return frameUrl;
        }

        const waitMs = Math.min(SAMPLE_MOVIE_POLL_MS, deadline - Date.now());
        if (waitMs <= 0) break;

        const responseUrl = await Promise.race([
          detected,
          new Promise<null>((resolve) => setTimeout(resolve, waitMs)),
        ]);
        if (responseUrl) return responseUrl;
      }

      return detectedUrl;
    },
    stop() {
      page.off("response", onResponse);
    },
  };
}
