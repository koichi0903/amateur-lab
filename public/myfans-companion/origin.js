(function initMyfansDailyPageOrigin(global) {
  const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);
  const PRODUCTION_ORIGINS = new Set([
    "https://hakkutsu-lab.com",
    "https://amateur-lab.vercel.app"
  ]);

  function resolve(value) {
    try {
      const url = new URL(String(value || ""));
      const origin = url.origin;
      const isCanonicalLocal = url.protocol === "http:"
        && LOCAL_HOSTS.has(url.hostname)
        && url.port === "3000";
      const isProduction = url.protocol === "https:" && PRODUCTION_ORIGINS.has(origin);
      const isAdminPath = url.pathname === "/admin/myfans" || url.pathname.startsWith("/admin/myfans/");
      if (!isAdminPath || (!isCanonicalLocal && !isProduction)) return null;
      const media = url.searchParams.get("media") || "";
      return {
        baseUrl: origin,
        approvedMediaId: /^[1-9]\d*$/.test(media) ? media : "",
        kind: isCanonicalLocal ? "local" : "production"
      };
    } catch {
      return null;
    }
  }

  global.MyfansDailyPageOrigin = Object.freeze({
    resolve,
    isDailyPage(value) {
      return Boolean(resolve(value));
    }
  });
})(globalThis);
