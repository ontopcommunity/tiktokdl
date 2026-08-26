import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const maxDuration = 30;

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const MAX_BYTES = 200 * 1024 * 1024; // 200MB

function getAdmin(): SupabaseClient {
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function ensureBucket(supabase: SupabaseClient) {
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some((b: { name: string }) => b.name === "videos");
  if (!exists) {
    await supabase.storage.createBucket("videos", {
      public: true,
      fileSizeLimit: MAX_BYTES,
      allowedMimeTypes: ["video/mp4", "video/webm", "video/quicktime", "video/*"],
    });
  } else {
    // try update limit
    try {
      await supabase.storage.updateBucket("videos", {
        public: true,
        fileSizeLimit: MAX_BYTES,
      });
    } catch (_) {}
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const filename = (body.filename as string) || "video.mp4";
    const contentType = (body.contentType as string) || "video/mp4";
    const size = Number(body.size) || 0;

    if (size > MAX_BYTES) {
      return NextResponse.json(
        { error: `File quá lớn. Tối đa 200MB (nhận ${ (size / 1024 / 1024).toFixed(1) }MB)` },
        { status: 413 }
      );
    }

    if (contentType && !contentType.startsWith("video/") && contentType !== "application/octet-stream") {
      return NextResponse.json({ error: "Chỉ chấp nhận file video" }, { status: 400 });
    }

    const supabase = getAdmin();
    await ensureBucket(supabase);

    const id = randomUUID();
    let ext = "mp4";
    if (contentType.includes("webm")) ext = "webm";
    else if (contentType.includes("quicktime") || contentType.includes("mov")) ext = "mov";
    else {
      const parts = filename.split(".");
      if (parts.length > 1) {
        const e = parts.pop()!.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (e) ext = e;
      }
    }
    const path = `${id}.${ext}`;

    // Signed upload URL – client uploads directly to Supabase (bypass Vercel body limit)
    const { data, error } = await supabase.storage
      .from("videos")
      .createSignedUploadUrl(path);

    if (error || !data) {
      console.error("createSignedUploadUrl error:", error);
      return NextResponse.json(
        { error: error?.message || "Không tạo được signed upload URL" },
        { status: 500 }
      );
    }

    const host = req.headers.get("host") || "tiktokdl-self.vercel.app";
    const protocol = host.includes("localhost") ? "http" : "https";
    const viewUrl = `${protocol}://${host}/api/v/${path}`;

    const { data: publicData } = supabase.storage.from("videos").getPublicUrl(path);

    return NextResponse.json({
      success: true,
      path,
      id,
      token: data.token,
      signedUrl: data.signedUrl,
      viewUrl,
      supabaseUrl: publicData.publicUrl,
      maxMB: 200,
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
