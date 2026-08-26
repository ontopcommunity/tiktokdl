import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const maxDuration = 60;

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

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
    const { error } = await supabase.storage.createBucket("videos", {
      public: true,
      fileSizeLimit: 100 * 1024 * 1024,
      allowedMimeTypes: ["video/mp4", "video/webm", "video/quicktime", "video/*"],
    });
    if (error && !error.message.includes("already exists")) {
      console.error("createBucket error:", error);
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Missing file. Gửi field 'file'." }, { status: 400 });
    }

    // Validate video
    const contentType = file.type || "video/mp4";
    if (!contentType.startsWith("video/") && !contentType.includes("octet-stream")) {
      return NextResponse.json(
        { error: "Chỉ chấp nhận file video (mp4, webm, mov...)" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const sizeMB = (buffer.length / (1024 * 1024)).toFixed(2);

    if (buffer.length > 95 * 1024 * 1024) {
      return NextResponse.json(
        { error: `File quá lớn (${sizeMB} MB). Tối đa ~95MB.` },
        { status: 413 }
      );
    }

    if (buffer.length < 1000) {
      return NextResponse.json({ error: "File rỗng hoặc quá nhỏ" }, { status: 400 });
    }

    const supabase = getAdmin();
    await ensureBucket(supabase);

    const id = randomUUID();
    let ext = "mp4";
    if (contentType.includes("webm")) ext = "webm";
    else if (contentType.includes("quicktime") || contentType.includes("mov")) ext = "mov";
    else if (file.name) {
      const parts = file.name.split(".");
      if (parts.length > 1) ext = parts.pop()!.toLowerCase().replace(/[^a-z0-9]/g, "") || "mp4";
    }
    const path = `${id}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("videos")
      .upload(path, buffer, {
        contentType: contentType.startsWith("video/") ? contentType : "video/mp4",
        upsert: false,
        cacheControl: "public, max-age=31536000",
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json(
        { error: uploadError.message || "Upload lên Supabase thất bại" },
        { status: 500 }
      );
    }

    const { data: publicData } = supabase.storage.from("videos").getPublicUrl(path);
    const supabasePublicUrl = publicData.publicUrl;

    const host = req.headers.get("host") || "tiktokdl-self.vercel.app";
    const protocol = host.includes("localhost") ? "http" : "https";
    const viewUrl = `${protocol}://${host}/api/v/${path}`;

    return NextResponse.json({
      success: true,
      id,
      filename: path,
      originalName: file.name,
      sizeMB,
      contentType,
      viewUrl,
      supabaseUrl: supabasePublicUrl,
      message: "Video đã upload lên Supabase. Dùng viewUrl để xem (có CORS).",
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
