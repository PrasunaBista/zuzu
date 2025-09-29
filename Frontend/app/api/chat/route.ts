import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json();
  const message = body.message || "";

  // TODO: Replace with LangChain call
  return NextResponse.json({
    reply: `You said: ${message}. (Replace with real AI response)`,
  });
}
