import { auth } from "@clerk/nextjs";
import { type NextRequest, NextResponse } from "next/server";

import { increaseApiLimit, checkApiLimit } from "@/lib/api-limit";
import { checkSubscription } from "@/lib/subscription";

export async function POST(req: NextRequest) {
  try {
    const { userId } = auth();
    const body = await req.json();
    const { prompt } = body;

    if (!userId) return new NextResponse("Unauthorized.", { status: 401 });

    if (!process.env.JAMENDO_CLIENT_ID) {
      return new NextResponse("Jamendo client ID not configured.", { status: 500 });
    }

    if (!prompt) return new NextResponse("Prompt is required.", { status: 400 });

    const freeTrial = await checkApiLimit();
    const isPro = await checkSubscription();

    if (!freeTrial && !isPro) {
      return new NextResponse("Free trial has expired.", { status: 403 });
    }

    const response = await fetch(
      `https://api.jamendo.com/v3.0/tracks/?client_id=${process.env.JAMENDO_CLIENT_ID}&format=json&limit=1&search=${encodeURIComponent(prompt)}`
    );

    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      return new NextResponse("No music found.", { status: 404 });
    }

    if (!isPro) await increaseApiLimit();

    return NextResponse.json([data.results[0].audio], { status: 200 });
  } catch (error) {
    console.error("[MUSIC_ERROR]:", error);
    return new NextResponse("Internal server error.", { status: 500 });
  }
}