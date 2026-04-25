import { NextResponse } from "next/server";
import { parseOcrTextToRecognizedItems } from "../../../../lib/orders/photo-import";

export const runtime = "nodejs";

type OcrSpaceParsedResult = {
  ParsedText?: string;
};

type OcrSpacePayload = {
  IsErroredOnProcessing?: boolean;
  ErrorMessage?: string[] | string;
  ParsedResults?: OcrSpaceParsedResult[];
};

async function requestOcr(
  imageFile: File,
  apiKey: string,
  options: {
    engine: "1" | "2";
    isTable: boolean;
  }
) {
  const formData = new FormData();
  formData.append("file", imageFile, imageFile.name || "upload.jpg");
  formData.append("language", "rus");
  formData.append("isOverlayRequired", "false");
  formData.append("detectOrientation", "true");
  formData.append("scale", "true");
  formData.append("OCREngine", options.engine);
  formData.append("isTable", options.isTable ? "true" : "false");

  const response = await fetch("https://api.ocr.space/parse/image", {
    method: "POST",
    headers: {
      apikey: apiKey,
    },
    body: formData,
  });

  const payload = (await response.json()) as OcrSpacePayload;

  return { response, payload };
}

export async function POST(request: Request) {
  const requestFormData = await request.formData();
  const imageFile = requestFormData.get("file");

  if (!(imageFile instanceof File)) {
    return NextResponse.json({ error: "Image is required" }, { status: 400 });
  }

  const apiKey = process.env.OCR_SPACE_API_KEY || "helloworld";
  const attempts = [
    { engine: "2" as const, isTable: true },
    { engine: "2" as const, isTable: false },
    { engine: "1" as const, isTable: false },
  ];

  let lastErrorMessage = "OCR service request failed";
  let bestParsedText = "";
  let bestItems: ReturnType<typeof parseOcrTextToRecognizedItems> = [];

  for (const attempt of attempts) {
    const { response, payload } = await requestOcr(imageFile, apiKey, attempt);

    if (!response.ok) {
      lastErrorMessage = "OCR service request failed";
      continue;
    }

    if (payload.IsErroredOnProcessing) {
      lastErrorMessage = Array.isArray(payload.ErrorMessage)
        ? payload.ErrorMessage.join(". ")
        : payload.ErrorMessage || "OCR service failed to process the image.";
      continue;
    }

    const parsedText = (payload.ParsedResults || [])
      .map((result) => result.ParsedText || "")
      .join("\n");

    const items = parseOcrTextToRecognizedItems(parsedText);

    if (parsedText.trim().length > bestParsedText.trim().length) {
      bestParsedText = parsedText;
    }

    if (items.length > bestItems.length) {
      bestItems = items;
    }

    if (items.length >= 1) {
      break;
    }
  }

  if (!bestParsedText.trim() && bestItems.length === 0) {
    return NextResponse.json(
      { error: lastErrorMessage },
      { status: 500 }
    );
  }

  return NextResponse.json({
    items: bestItems,
    notes: bestParsedText.trim(),
  });
}
