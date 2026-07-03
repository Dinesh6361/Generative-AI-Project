import { auth } from "@clerk/nextjs";
import { type NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

import { increaseApiLimit, checkApiLimit } from "@/lib/api-limit";
import { checkSubscription } from "@/lib/subscription";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const instructionMessage = {
  role: "system" as const,
  content:
    "You are a code generator. Answer only with code. Use simple code comments for explanation. Do not use extra lines like --- or ***.",
};

export async function POST(req: NextRequest) {
  try {
    const { userId } = auth();
    const body = await req.json();
    const { messages } = body;

    if (!userId) {
      return new NextResponse("Unauthorized.", { status: 401 });
    }

    if (!process.env.GROQ_API_KEY) {
      return new NextResponse("Groq API key not configured.", { status: 500 });
    }

    if (!messages) {
      return new NextResponse("Messages are required.", { status: 400 });
    }

    const freeTrial = await checkApiLimit();
    const isPro = await checkSubscription();

    if (!freeTrial && !isPro) {
      return new NextResponse("Free trial has expired.", { status: 403 });
    }

    const response = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [instructionMessage, ...messages],
      temperature: 0.3,
      max_tokens: 800,
    });

    if (!isPro) {
      await increaseApiLimit();
    }

    return NextResponse.json(response.choices[0].message, { status: 200 });
  } catch (error: unknown) {
    console.error("[CODE_ERROR]: ", error);
    return new NextResponse("Internal server error.", { status: 500 });
  }
}