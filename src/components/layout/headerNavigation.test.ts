import assert from "node:assert/strict";
import test from "node:test";

import { getHeaderNavigation } from "./headerNavigation.ts";

test("素人カタログのrootと配下で専用メニューを使う", () => {
  const expectedHrefs = [
    "/amateur/sale",
    "/amateur/guides",
    "/amateur/search",
    "/amateur/actress",
    "/amateur/genre",
    "/amateur/maker",
    "/amateur/personal-pick",
  ];

  assert.deepEqual(getHeaderNavigation("/amateur").menus.map((menu) => menu.href), expectedHrefs);
  assert.deepEqual(getHeaderNavigation("/amateur/actress/example").menus.map((menu) => menu.href), expectedHrefs);
});

test("通常routeとprefixだけが似るrouteでは通常メニューを使う", () => {
  const expectedHrefs = ["/sale", "/guides", "/search", "/actress", "/amateur", "/genre", "/maker", "/personal-pick"];

  for (const pathname of ["/", "/compare", "/amateurish"]) {
    assert.deepEqual(getHeaderNavigation(pathname).menus.map((menu) => menu.href), expectedHrefs);
  }
});

test("pathnameがnullの場合も従来どおり通常メニューを返す", () => {
  const navigation = getHeaderNavigation(null);

  assert.equal(navigation.isAmateurCatalog, undefined);
  assert.equal(navigation.menus[0]?.href, "/sale");
});
