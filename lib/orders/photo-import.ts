import type { ItemForm } from "./types";
import { getImportedItemIssues } from "./utils";

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
      importSource: "photo" as const,
      importIssues: getImportedItemIssues({
        article: item.article?.trim() || "",
        name: item.name?.trim() || "",
        quantity: item.quantity?.trim() || "",
      }),
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

export async function prepareImageFileForUpload(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Нужен файл изображения.");
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Не удалось открыть изображение."));
      img.src = objectUrl;
    });

    const maxSide = 1600;
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Не удалось подготовить изображение.");
    }

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (result) resolve(result);
          else reject(new Error("Не удалось уменьшить фото."));
        },
        "image/jpeg",
        0.82
      );
    });

    const safeName = (file.name || "photo")
      .replace(/\.[^.]+$/, "")
      .replace(/[^\w\-]+/g, "-");

    return new File([blob], `${safeName || "photo"}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
