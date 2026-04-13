import { NextResponse } from "next/server";
import { listTemplateTags } from "@/lib/db";

export async function GET() {
  try {
    const tags = listTemplateTags(true); // active only
    return NextResponse.json({ success: true, tags });
  } catch {
    return NextResponse.json({ success: true, tags: [] }); // graceful fallback
  }
}
