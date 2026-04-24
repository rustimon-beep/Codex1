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

export async function fileToVisionDataUrl(file: File) {
  const fileDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Не удалось прочитать фото."));
    };
    reader.onerror = () => reject(new Error("Не удалось прочитать фото."));
    reader.readAsDataURL(file);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Не удалось подготовить фото."));
    img.src = fileDataUrl;
  });

  const maxSide = 1800;
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Не удалось подготовить изображение для распознавания.");
  }

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);

  return canvas.toDataURL("image/jpeg", 0.9);
}
