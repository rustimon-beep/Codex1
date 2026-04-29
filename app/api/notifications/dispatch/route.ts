import { NextResponse } from "next/server";
import { dispatchNotificationEventPush } from "../../../../lib/notifications/push-server";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { eventId?: string };

    if (!body.eventId) {
      return NextResponse.json({ error: "Missing eventId" }, { status: 400 });
    }

    await dispatchNotificationEventPush(body.eventId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Push dispatch failed",
      },
      { status: 500 }
    );
  }
}
