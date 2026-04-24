import type { ItemForm } from "./types";

export type RecognizedOrderItem = {
  article: string;
  name: string;
  quantity: string;
};

export function normalizeRecognizedItems(items: RecognizedOrderItem[]): ItemForm[] {
  return items
    .map((item) => ({
      article: item.article?.trim() || "",
      hasReplacement: false,
      replacementArticle: "",
      name: item.name?.trim() || "",
      quantity: item.quantity?.trim() || "",
      plannedDate: "",
      status: "Новый",
      deliveredDate: "",
      canceledDate: "",
    }))
    .filter((item) => item.article || item.name || item.quantity);
}

export function extractJsonObject(text: string) {
  const trimmed = text.trim();

  if (trimmed.startsWith("```")) {
    const withoutFence = trimmed
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/, "");
    return withoutFence.trim();
  }

  return trimmed;
}

function cleanCell(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function stripLineJunk(value: string) {
  return cleanCell(
    value
      .replace(/^[#№\-\–\—•*\.\)\(]+/, "")
      .replace(/[|]+/g, " ")
      .replace(/\b(шт|штук|pcs|pc)\b/gi, "")
  );
}

function looksLikeArticle(value: string) {
  const normalized = stripLineJunk(value);
  return /^[A-Za-zА-Яа-я0-9][A-Za-zА-Яа-я0-9\-_.\/]{1,}$/.test(normalized);
}

function looksLikeQuantity(value: string) {
  const normalized = stripLineJunk(value).replace(",", ".");
  return /^\d+([.]\d+)?$/.test(normalized);
}

function lineToRecognizedItem(line: string): RecognizedOrderItem | null {
  const normalized = stripLineJunk(line);
  if (!normalized) return null;

  if (
    /артикул|наименование|колич|кол-во|итого|сумма|цена|товар/i.test(normalized)
  ) {
    return null;
  }

  const splitByColumns = normalized.split(/\s{2,}|\t+/).map(cleanCell).filter(Boolean);

  if (splitByColumns.length >= 3) {
    const [first, ...rest] = splitByColumns;
    const last = rest[rest.length - 1];
    const middle = rest.slice(0, -1).join(" ");

    if (looksLikeArticle(first) && looksLikeQuantity(last)) {
      return {
        article: first,
        name: cleanCell(middle),
        quantity: last,
      };
    }
  }

  const tailMatch = normalized.match(/^([A-Za-z0-9][A-Za-z0-9\-_.]{2,})\s+(.+?)\s+(\d+(?:[.,]\d+)?)$/);
  if (tailMatch) {
    return {
      article: cleanCell(tailMatch[1]),
      name: cleanCell(tailMatch[2]),
      quantity: cleanCell(tailMatch[3]),
    };
  }

  const tokens = normalized.split(" ").filter(Boolean);
  if (tokens.length >= 3) {
    const articleIndex = tokens.findIndex((token) => looksLikeArticle(token));
    const quantityIndex = [...tokens].reverse().findIndex((token) => looksLikeQuantity(token));

    if (articleIndex !== -1 && quantityIndex !== -1) {
      const realQuantityIndex = tokens.length - 1 - quantityIndex;
      if (realQuantityIndex > articleIndex + 1) {
        const article = stripLineJunk(tokens[articleIndex]);
        const quantity = stripLineJunk(tokens[realQuantityIndex]);
        const name = cleanCell(tokens.slice(articleIndex + 1, realQuantityIndex).join(" "));

        if (article && name && quantity) {
          return { article, name, quantity };
        }
      }
    }
  }

  return null;
}

export function parseOcrTextToRecognizedItems(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map(cleanCell)
    .filter(Boolean)
    .filter((line) => line.length > 3);

  return lines
    .map(lineToRecognizedItem)
    .filter((item): item is RecognizedOrderItem => Boolean(item))
    .filter((item) => item.article || item.name || item.quantity);
}
