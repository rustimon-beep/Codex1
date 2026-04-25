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

function normalizeOcrArtifacts(value: string) {
  return cleanCell(
    value
      .replace(/[“”„"]/g, "")
      .replace(/[‐‑‒–—]/g, "-")
      .replace(/[•·]/g, " ")
      .replace(/\bI(?=\d)/g, "1")
      .replace(/(?<=\d)O\b/g, "0")
  );
}

function looksLikeArticle(value: string) {
  const normalized = normalizeOcrArtifacts(stripLineJunk(value));
  return /^[A-Za-zА-Яа-я0-9][A-Za-zА-Яа-я0-9\-_.\/]{1,}$/.test(normalized);
}

function looksLikeQuantity(value: string) {
  const normalized = normalizeOcrArtifacts(stripLineJunk(value)).replace(",", ".");
  return /^\d+([.]\d+)?$/.test(normalized);
}

function lineToRecognizedItem(line: string): RecognizedOrderItem | null {
  const normalized = normalizeOcrArtifacts(stripLineJunk(line));
  if (!normalized) return null;

  if (
    /артикул|наименование|колич|кол-во|итого|сумма|цена|товар|номер|дата|заказ/i.test(normalized)
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

function scoreRecognizedItem(item: RecognizedOrderItem | null) {
  if (!item) return -1;

  let score = 0;
  if (item.article) score += 2;
  if (item.name) score += 3;
  if (item.quantity) score += 2;
  if (item.name.length > 6) score += 1;
  if (looksLikeArticle(item.article)) score += 1;
  if (looksLikeQuantity(item.quantity)) score += 1;

  return score;
}

export function parseOcrTextToRecognizedItems(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => normalizeOcrArtifacts(cleanCell(line)))
    .filter(Boolean)
    .filter((line) => line.length > 2);

  const items: RecognizedOrderItem[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const single = lineToRecognizedItem(lines[index]);
    const double = index + 1 < lines.length
      ? lineToRecognizedItem(`${lines[index]} ${lines[index + 1]}`)
      : null;
    const triple = index + 2 < lines.length
      ? lineToRecognizedItem(`${lines[index]} ${lines[index + 1]} ${lines[index + 2]}`)
      : null;

    const variants = [
      { span: 1, item: single },
      { span: 2, item: double },
      { span: 3, item: triple },
    ];

    const bestVariant = variants
      .map((variant) => ({ ...variant, score: scoreRecognizedItem(variant.item) }))
      .sort((a, b) => b.score - a.score)[0];

    if (bestVariant && bestVariant.score >= 7 && bestVariant.item) {
      items.push(bestVariant.item);
      index += bestVariant.span - 1;
      continue;
    }

    if (single) {
      items.push(single);
    }
  }

  const deduped = items.filter((item, index, array) => {
    const key = `${item.article}|${item.name}|${item.quantity}`.toLowerCase();
    return array.findIndex((candidate) => {
      const candidateKey =
        `${candidate.article}|${candidate.name}|${candidate.quantity}`.toLowerCase();
      return candidateKey === key;
    }) === index;
  });

  return deduped.filter((item) => item.article || item.name || item.quantity);
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

    const maxSide = 2000;
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

    const imageData = ctx.getImageData(0, 0, width, height);
    const { data } = imageData;

    for (let i = 0; i < data.length; i += 4) {
      const luminance = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      const boosted = luminance > 170 ? 255 : luminance < 110 ? 0 : luminance;

      data[i] = boosted;
      data[i + 1] = boosted;
      data[i + 2] = boosted;
    }

    ctx.putImageData(imageData, 0, 0);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (result) resolve(result);
          else reject(new Error("Не удалось уменьшить фото."));
        },
        "image/jpeg",
        0.9
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
