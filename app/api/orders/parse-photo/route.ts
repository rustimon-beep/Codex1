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

export async function POST(request: Request) {
  const { imageDataUrl } = await request.json();

  if (!imageDataUrl || typeof imageDataUrl !== "string") {
    return NextResponse.json({ error: "Image is required" }, { status: 400 });
  }

  const apiKey = process.env.OCR_SPACE_API_KEY || "helloworld";
  const formData = new FormData();
  formData.append("base64Image", imageDataUrl);
  formData.append("language", "auto");
  formData.append("isOverlayRequired", "false");
  formData.append("detectOrientation", "true");
  formData.append("scale", "true");
  formData.append("OCREngine", "2");
  formData.append("isTable", "true");

  const response = await fetch("https://api.ocr.space/parse/image", {
    method: "POST",
    headers: {
      apikey: apiKey,
    },
    body: formData,
  });

  const payload = (await response.json()) as OcrSpacePayload;

  if (!response.ok) {
    return NextResponse.json(
      { error: "OCR service request failed" },
      { status: response.status }
    );
  }

  if (payload.IsErroredOnProcessing) {
    const message = Array.isArray(payload.ErrorMessage)
      ? payload.ErrorMessage.join(". ")
      : payload.ErrorMessage || "OCR service failed to process the image.";

    return NextResponse.json(
      {
        error: message,
      },
      { status: 500 }
    );
  }

  const parsedText = (payload.ParsedResults || [])
    .map((result) => result.ParsedText || "")
    .join("\n");

  const items = parseOcrTextToRecognizedItems(parsedText);

  return NextResponse.json({
    items,
    notes: parsedText.trim(),
  });
}
