export type MyfansReportRow = {
  occurredAt: string;
  productUrl: string;
  title: string;
  conversionType: string;
  saleAmount: number;
  rewardAmount: number;
  rewardRate: number;
};

function parseNumber(value: string | undefined) {
  const normalized = (value ?? "").normalize("NFKC").replace(/[^\d.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && next === '"') {
      current += '"';
      index++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

function get(row: Record<string, string>, names: string[]) {
  for (const name of names) {
    const value = row[name];
    if (value) return value;
  }
  return "";
}

export function parseMyfansReportCsv(text: string) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]).map((header) => header.normalize("NFKC").trim());
  return lines.slice(1).map((line): MyfansReportRow => {
    const cells = splitCsvLine(line);
    const row = Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
    const saleAmount = parseNumber(get(row, ["売上", "売上金額", "購入金額", "sale_amount"]));
    const rewardAmount = parseNumber(get(row, ["報酬", "報酬金額", "成果報酬", "reward_amount"]));
    const rewardRate = parseNumber(get(row, ["報酬率", "料率", "reward_rate"]));

    return {
      occurredAt: get(row, ["発生日", "購入日", "日時", "occurred_at"]) || new Date().toISOString(),
      productUrl: get(row, ["商品URL", "myfans URL", "URL", "product_url"]),
      title: get(row, ["商品名", "タイトル", "title"]),
      conversionType: get(row, ["種別", "成果種別", "conversion_type"]) || "single",
      saleAmount,
      rewardAmount,
      rewardRate,
    };
  }).filter((row) => row.title || row.productUrl || row.rewardAmount > 0);
}
