import assert from "node:assert/strict";
import test from "node:test";
import { parseFanzaReportCsv } from "./fanzaReportCsv";

test("FANZA report CSV preserves quoted commas, escaped quotes, and embedded newlines", () => {
  const rows = parseFanzaReportCsv([
    "商品名,販売件数,販売金額,報酬額",
    '"作品, 特別",2,"¥1,000",150',
    '"作品 ""引用""\n続き",1,400,"(¥25)"',
    "合計,3,1400,125",
    "",
  ].join("\r\n"));

  assert.deepEqual(rows, [
    { productId: "", title: "作品, 特別", salesCount: 2, salesAmount: 1000, commissionAmount: 150 },
    { productId: "", title: '作品 "引用"\n続き', salesCount: 1, salesAmount: 400, commissionAmount: -25 },
  ]);
});

test("FANZA report CSV rejects a header-only file", () => {
  assert.throws(() => parseFanzaReportCsv("商品名,販売件数\r\n"), /CSVに明細行がありません/);
});
