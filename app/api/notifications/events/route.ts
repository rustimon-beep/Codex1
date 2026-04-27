import { NextResponse } from "next/server";
import {
  createNotificationEvents,
  type NotificationEventDraft,
} from "../../../../lib/notifications/server-events";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { events?: NotificationEventDraft[] };

    if (!body.events || !Array.isArray(body.events) || body.events.length === 0) {
      return NextResponse.json({ error: "Missing events" }, { status: 400 });
    }

    await createNotificationEvents(body.events);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Notification event creation failed",
      },
      { status: 500 }
    );
  }
}
