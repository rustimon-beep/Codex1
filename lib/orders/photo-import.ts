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
