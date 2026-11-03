import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAmateurEntityBrowseRequest,
  buildAmateurEntityPageHref,
  buildAmateurEntityPath,
  decodeAmateurEntityName,
  getAmateurEntityPageCopy,
  resolveAmateurEntitySort,
} from "./amateurEntityDetailProjection.ts";

test("entity names decode valid paths and retain malformed values", () => {
  assert.equal(decodeAmateurEntityName("%E5%A5%B3%E5%84%AA"), "女優");
  assert.equal(decodeAmateurEntityName("%E0%A4%A"), "%E0%A4%A");
});

test("entity browse requests keep genre and maker filters separate", () => {
  assert.deepEqual(buildAmateurEntityBrowseRequest("genre", "女優", 2, "price"), {
    page: 2,
    genre: "女優",
    sort: "price",
  });
  assert.deepEqual(buildAmateurEntityBrowseRequest("maker", "maker name", 1, "rank"), {
    page: 1,
    maker: "maker name",
    sort: "rank",
  });
});

test("entity sort, paths, pagination links, and page copy preserve defaults", () => {
  assert.equal(resolveAmateurEntitySort("review"), "review");
  assert.equal(resolveAmateurEntitySort("unknown"), "rank");
  const path = buildAmateurEntityPath("genre", "女優 名");
  assert.equal(path, "/amateur/genre/%E5%A5%B3%E5%84%AA%20%E5%90%8D");
  assert.equal(buildAmateurEntityPageHref(path, "rank", 1), path);
  assert.equal(buildAmateurEntityPageHref(path, "date_desc", 3), `${path}?sort=date_desc&page=3`);
  assert.deepEqual(getAmateurEntityPageCopy("maker", "maker name", 1234), {
    displayLabel: "MAKER",
    kindLabel: "メーカー",
    pageTitle: "maker name｜FANZA素人作品のメーカー別一覧",
    pageDescription: "maker nameのFANZA素人作品を人気順などで掲載。登録作品数は1,234件です。各作品の発売日・価格・サンプルを確認できます。",
  });
});
