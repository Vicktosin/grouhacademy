import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { getPrisma } from "@/lib/prisma";
import {
  settleSuccessfulPaystackPayment,
  type PaystackSettlementPrisma,
  type PaystackWebhookEvent,
} from "@/lib/paystack-webhook";

export function isValidPaystackSignature(
  rawBody: string,
  signature: string,
  secretKey: string,
) {
  if (!signature) return false;
  const expected = createHmac("sha512", secretKey)
    .update(rawBody)
    .digest("hex");
  const receivedBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  return (
    receivedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(receivedBuffer, expectedBuffer)
  );
}

export async function POST(request: Request) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json(
      { message: "Paystack is not configured." },
      { status: 503 },
    );
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature") ?? "";
  if (!isValidPaystackSignature(rawBody, signature, secretKey)) {
    console.warn("[paystack-webhook] Rejected request with invalid signature.");
    return NextResponse.json(
      { message: "Invalid Paystack signature." },
      { status: 401 },
    );
  }

  let payload: PaystackWebhookEvent;
  try {
    payload = JSON.parse(rawBody) as PaystackWebhookEvent;
  } catch {
    return NextResponse.json(
      { message: "Malformed Paystack payload." },
      { status: 400 },
    );
  }

  const event = payload.event;
  const data = payload.data ?? {};

  console.info("[paystack-webhook] Received event.", {
    event,
    reference: typeof data.reference === "string" ? data.reference : undefined,
  });

  if (event !== "charge.success" || data.status !== "success") {
    return NextResponse.json({ status: "ignored" });
  }

  const prisma = getPrisma();
  const settlement = await settleSuccessfulPaystackPayment(
    prisma as unknown as PaystackSettlementPrisma,
    payload,
  );
  console.info("[paystack-webhook] Settlement completed.", settlement);

  return NextResponse.json({ status: "success" });
}
