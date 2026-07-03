import { auth } from "@clerk/nextjs";
import { type NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

import { increaseApiLimit, checkApiLimit } from "@/lib/api-limit";
import { checkSubscription } from "@/lib/subscription";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

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
      messages: [
        {
          role: "system",
    content: `
You are a helpful AI assistant.

Rules:
1.give main headings and subheadings in the response.
1. Give answers with simple headings only.
2. Do NOT use **, *, #, ---, bullets, numbers, or code blocks.
3. Write the heading on one line.
4. Leave one empty line.
5. Write one short paragraph under the heading.
6. Keep the answer between 10 and 15 lines.
7. Use simple English.
8. Return plain text only.

Example format:

Introduction

Object-Oriented Programming (OOP) is a programming paradigm based on classes and objects. It helps organize code, improves reusability, and makes programs easier to maintain.

Features

Python supports classes, objects, inheritance, polymorphism, encapsulation, and abstraction. These features help developers build modular and efficient applications.
`, },
        ...messages,
      ],
      temperature: 0.7,
      max_tokens: 350,
    });

    if (!isPro) {
      await increaseApiLimit();
    }

    return NextResponse.json(response.choices[0].message, { status: 200 });
  } catch (error: unknown) {
    console.error("[CONVERSATION_ERROR]: ", error);
    return new NextResponse("Internal server error.", { status: 500 });
  }
}