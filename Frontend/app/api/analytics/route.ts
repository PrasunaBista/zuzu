import { NextResponse } from "next/server";

export async function GET(req: Request) {
  // TODO: Replace with DB query or LangChain
  return NextResponse.json({
    totalQuestions: 0,
    questionCategories: [],
    dailyQuestions: [],
  });
}
