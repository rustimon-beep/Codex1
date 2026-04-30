import { NextResponse } from "next/server";
import { dispatchNotificationEventEmail } from "../../../../lib/notifications/email-server";
import { dispatchNotificationEventPush } from "../../../../lib/notifications/push-server";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { eventId?: string };

    if (!body.eventId) {
      return NextResponse.json({ error: "Missing eventId" }, { status: 400 });
    }

    const results = await Promise.allSettled([
      dispatchNotificationEventPush(body.eventId),
      dispatchNotificationEventEmail(body.eventId),
    ]);

    const pushResult = results[0];
    const emailResult = results[1];

    if (pushResult.status === "rejected") {
      console.error("Push dispatch failed", {
        eventId: body.eventId,
        message:
          pushResult.reason instanceof Error
            ? pushResult.reason.message
            : String(pushResult.reason),
      });
    }

    if (emailResult.status === "rejected") {
      console.error("Email dispatch failed", {
        eventId: body.eventId,
        message:
          emailResult.reason instanceof Error
            ? emailResult.reason.message
            : String(emailResult.reason),
      });
    }

    return NextResponse.json({
      ok: true,
      push: pushResult.status === "fulfilled",
      email: emailResult.status === "fulfilled",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Push dispatch failed",
      },
      { status: 500 }
    );
  }
}
