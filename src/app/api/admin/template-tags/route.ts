import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/getRequestUser";
import { listTemplateTags, createTemplateTag } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const tags = listTemplateTags(false); // include inactive
    return NextResponse.json({ success: true, tags });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Failed to list tags" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const body = await req.json();
    const { label, groupKey, icon, sortOrder } = body;

    if (!label?.trim()) {
      return NextResponse.json({ error: "Label is required" }, { status: 400 });
    }
    if (!["generation", "task", "provider", "style"].includes(groupKey)) {
      return NextResponse.json({ error: "Invalid group" }, { status: 400 });
    }

    const tag = createTemplateTag({ label, groupKey, icon, sortOrder });
    return NextResponse.json({ success: true, tag }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const msg = err instanceof Error ? err.message : "Failed to create tag";
    // Handle UNIQUE constraint violation
    if (msg.includes("UNIQUE")) {
      return NextResponse.json({ error: "A tag with this name already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
