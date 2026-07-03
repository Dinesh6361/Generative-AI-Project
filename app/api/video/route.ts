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

    if (!process.env.PEXELS_API_KEY) {
      return new NextResponse("Pexels API key not configured.", { status: 500 });
    }

    if (!prompt) {
      return new NextResponse("Prompt is required.", { status: 400 });
    }

    const freeTrial = await checkApiLimit();
    const isPro = await checkSubscription();

    if (!freeTrial && !isPro) {
      return new NextResponse("Free trial has expired.", { status: 403 });
    }

    const res = await fetch(
      `https://api.pexels.com/videos/search?query=${encodeURIComponent(
        prompt
      )}&per_page=1`,
      {
        headers: {
          Authorization: process.env.PEXELS_API_KEY,
        },
      }
    );

    const data = await res.json();

    if (!data.videos || data.videos.length === 0) {
      return new NextResponse("No video found.", { status: 404 });
    }

    const videoUrl =
      data.videos[0].video_files.find((file: any) => file.quality === "hd")
        ?.link || data.videos[0].video_files[0].link;

    if (!isPro) await increaseApiLimit();

    return NextResponse.json([videoUrl], { status: 200 });
  } catch (error: unknown) {
    console.error("[VIDEO_ERROR]: ", error);
    return new NextResponse("Internal server error.", { status: 500 });
  }
}