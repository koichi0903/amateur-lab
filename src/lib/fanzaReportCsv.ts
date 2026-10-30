export type FanzaReportRow = {
  productId: string;
  title: string;
  salesCount: number;
  salesAmount: number;
  commissionAmount: number;
};

const HEADER_ALIASES = {
  productId: ["品番", "商品ID", "商品コード", "コンテンツID", "contentid", "productid"],
  title: ["商品名", "作品名", "作品タイトル", "タイトル"],
  salesCount: ["販売件数", "売上件数", "報酬件数", "成果件数", "件数", "数量"],
  salesAmount: ["販売金額", "売上金額", "売上額", "注文金額", "購入金額"],
  commissionAmount: ["報酬額", "報酬金額", "成果報酬額", "報酬額合計", "未確定報酬額"],
} as const;

function normalizeHeader(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[\s_\-・/／()（）]/g, "")
    .toLowerCase();
}

function findColumn(headers: string[], aliases: readonly string[]) {
  const normalized = headers.map(normalizeHeader);
  const exact = aliases
    .map(normalizeHeader)
    .map((alias) => normalized.indexOf(alias))
    .find((index) => index >= 0);
  if (exact !== undefined) return exact;

  return normalized.findIndex((header) =>
    aliases.some((alias) => header.includes(normalizeHeader(alias))),
  );
}

type CsvParserState = {
  rows: string[][];
  row: string[];
  value: string;
  quoted: boolean;
};

function finishCsvRow(state: CsvParserState) {
  state.row.push(state.value);
  if (state.row.some((cell) => cell.trim())) state.rows.push(state.row);
  state.row = [];
  state.value = "";
}

function consumeCsvQuote(state: CsvParserState, next: string | undefined) {
  if (state.quoted && next === '"') {
    state.value += '"';
    return 1;
  }
  state.quoted = !state.quoted;
  return 0;
}

function consumeCsvCharacter(state: CsvParserState, char: string, next: string | undefined) {
  if (char === '"') return consumeCsvQuote(state, next);
  if (char === "," && !state.quoted) {
    state.row.push(state.value);
    state.value = "";
    return 0;
  }
  if ((char === "\n" || char === "\r") && !state.quoted) {
    const isCrLf = char === "\r" && next === "\n";
    finishCsvRow(state);
    return isCrLf ? 1 : 0;
  }
  state.value += char;
  return 0;
}

function parseCsv(text: string) {
  const state: CsvParserState = { rows: [], row: [], value: "", quoted: false };
  for (let index = 0; index < text.length; index += 1) {
    index += consumeCsvCharacter(state, text[index], text[index + 1]);
  }
  finishCsvRow(state);
  return state.rows;
}

function parseNumber(value: string | undefined) {
  const normalized = (value ?? "")
    .normalize("NFKC")
    .replace(/[¥￥円,，\s]/g, "")
    .trim();
  if (!normalized) return 0;

  const negative = /^\(.*\)$/.test(normalized);
  const numeric = Number(normalized.replace(/[()]/g, ""));
  if (!Number.isFinite(numeric)) return 0;
  return Math.round(negative ? -numeric : numeric);
}

export function decodeFanzaReportCsv(bytes: ArrayBuffer) {
  const utf8 = new TextDecoder("utf-8").decode(bytes);
  const replacementCount = (utf8.match(/�/g) ?? []).length;
  if (replacementCount === 0) return utf8.replace(/^\uFEFF/, "");

  try {
    return new TextDecoder("shift_jis").decode(bytes).replace(/^\uFEFF/, "");
  } catch {
    return utf8.replace(/^\uFEFF/, "");
  }
}

export function parseFanzaReportCsv(text: string): FanzaReportRow[] {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error("CSVに明細行がありません。");

  const headers = rows[0].map((header) => header.trim());
  const columns = {
    productId: findColumn(headers, HEADER_ALIASES.productId),
    title: findColumn(headers, HEADER_ALIASES.title),
    salesCount: findColumn(headers, HEADER_ALIASES.salesCount),
    salesAmount: findColumn(headers, HEADER_ALIASES.salesAmount),
    commissionAmount: findColumn(headers, HEADER_ALIASES.commissionAmount),
  };

  if (columns.title < 0) {
    throw new Error(`商品名の列を判別できません。検出した見出し: ${headers.join(" / ")}`);
  }
  if (columns.salesCount < 0 && columns.salesAmount < 0 && columns.commissionAmount < 0) {
    throw new Error(`売上・報酬列を判別できません。検出した見出し: ${headers.join(" / ")}`);
  }

  return rows.slice(1).flatMap((cells) => {
    const title = (cells[columns.title] ?? "").trim();
    if (!title || /^(合計|総計|total)$/i.test(title.normalize("NFKC"))) return [];

    return [{
      productId: columns.productId >= 0 ? (cells[columns.productId] ?? "").trim() : "",
      title,
      salesCount: columns.salesCount >= 0 ? parseNumber(cells[columns.salesCount]) : 0,
      salesAmount: columns.salesAmount >= 0 ? parseNumber(cells[columns.salesAmount]) : 0,
      commissionAmount: columns.commissionAmount >= 0
        ? parseNumber(cells[columns.commissionAmount])
        : 0,
    }];
  });
}
