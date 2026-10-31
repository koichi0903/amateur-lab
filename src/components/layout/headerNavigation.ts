export type HeaderMenu = { href: string; label: string };

const primaryMenus: HeaderMenu[] = [
  { href: "/sale", label: "セール" },
  { href: "/guides", label: "ガイド" },
  { href: "/search", label: "詳細検索" },
  { href: "/actress", label: "女優検索" },
  { href: "/amateur", label: "素人作品" },
  { href: "/genre", label: "ジャンル検索" },
  { href: "/maker", label: "メーカー検索" },
  { href: "/personal-pick", label: "好み発掘" },
];

const amateurMenus: HeaderMenu[] = [
  { href: "/amateur/sale", label: "セール" },
  { href: "/amateur/guides", label: "ガイド" },
  { href: "/amateur/search", label: "詳細検索" },
  { href: "/amateur/actress", label: "女優検索" },
  { href: "/amateur/genre", label: "ジャンル検索" },
  { href: "/amateur/maker", label: "メーカー検索" },
  { href: "/amateur/personal-pick", label: "好み発掘" },
];

export function getHeaderNavigation(pathname: string | null) {
  const isAmateurCatalog = pathname === "/amateur" || pathname?.startsWith("/amateur/");
  return {
    isAmateurCatalog,
    menus: isAmateurCatalog ? amateurMenus : primaryMenus,
  };
}
