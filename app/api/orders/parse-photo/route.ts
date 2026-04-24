import { NextResponse } from "next/server";
import { extractJsonObject } from "../../../../lib/orders/photo-import";

export const runtime = "nodejs";

type ResponseContentPart = {
  type?: string;
  text?: string;
};

type ResponseOutputItem = {
  type?: string;
  content?: ResponseContentPart[];
};

type OpenAIResponsePayload = {
  output_text?: string;
  output?: ResponseOutputItem[];
  error?: {
    message?: string;
  };
};

function getOutputText(payload: OpenAIResponsePayload) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text;
  }

  if (Array.isArray(payload.output)) {
    for (const item of payload.output) {
      if (item.type === "message" && Array.isArray(item.content)) {
        const textPart = item.content.find((part) => part.type === "output_text");
        if (typeof textPart?.text === "string" && textPart.text.trim()) {
          return textPart.text;
        }
      }
    }
  }

  return "";
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured" },
      { status: 500 }
    );
  }

  const { imageDataUrl } = await request.json();

  if (!imageDataUrl || typeof imageDataUrl !== "string") {
    return NextResponse.json({ error: "Image is required" }, { status: 400 });
  }

  const model = process.env.OPENAI_VISION_MODEL || "gpt-4.1-mini";

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                "Ты распознаешь фото документа с перечнем товаров. Верни только JSON без пояснений в формате {\"items\":[{\"article\":\"\",\"name\":\"\",\"quantity\":\"\"}],\"notes\":\"\"}. " +
                "Извлекай только артикул, наименование и количество. Если значение не удалось уверенно распознать, оставляй пустую строку. Не придумывай данные.",
            },
            {
              type: "input_image",
              image_url: imageDataUrl,
              detail: "high",
            },
          ],
        },
      ],
    }),
  });

  const payload = (await response.json()) as OpenAIResponsePayload;

  if (!response.ok) {
    return NextResponse.json(
      { error: payload.error?.message || "Failed to parse image" },
      { status: response.status }
    );
  }

  const outputText = getOutputText(payload);

  if (!outputText) {
    return NextResponse.json({ error: "Model returned empty response" }, { status: 500 });
  }

  try {
    const parsed = JSON.parse(extractJsonObject(outputText));
    return NextResponse.json({
      items: Array.isArray(parsed?.items) ? parsed.items : [],
      notes: typeof parsed?.notes === "string" ? parsed.notes : "",
    });
  } catch {
    return NextResponse.json(
      {
        error: "Could not parse model response",
        raw: outputText,
      },
      { status: 500 }
    );
  }
}
