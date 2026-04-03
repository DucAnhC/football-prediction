import { NextResponse } from "next/server";

import {
  buildPredictionFromMatchId,
  buildPredictionFromPayload,
} from "@/services/prediction/api-route";

export async function GET(request: Request) {
  const matchId = new URL(request.url).searchParams.get("matchId");
  const result = await buildPredictionFromMatchId(matchId);

  if ("error" in result) {
    return NextResponse.json(
      { error: result.error.message },
      { status: result.error.status },
    );
  }

  return NextResponse.json(result.prediction);
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Nội dung JSON không hợp lệ." },
      { status: 400 },
    );
  }

  const result = await buildPredictionFromPayload(body);

  if ("error" in result) {
    return NextResponse.json(
      { error: result.error.message },
      { status: result.error.status },
    );
  }

  return NextResponse.json(result.prediction);
}
