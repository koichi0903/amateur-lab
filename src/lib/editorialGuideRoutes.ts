export function resolveGuideLink(href: string, basePath: string, isAmateurGuide: boolean) {
  if (!isAmateurGuide) return href;
  if (href === "/sale" || href.startsWith("/sale?") || href.startsWith("/sale#")) {
    return `/amateur${href}`;
  }
  if (href === "/guides" || href.startsWith("/guides/")) {
    return `${basePath}${href.slice("/guides".length)}`;
  }
  return href;
}
