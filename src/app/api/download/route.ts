import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const maxDuration = 60;

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function getAdmin() {
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function ensureBucket(supabase: ReturnType<typeof createClient>) {
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some((b) => b.name === "videos");
  if (!exists) {
    const { error } = await supabase.storage.createBucket("videos", {
      public: true,
      fileSizeLimit: 100 * 1024 * 1024, // 100MB
      allowedMimeTypes: ["video/mp4", "video/webm", "video/quicktime", "video/*"],
    });
    if (error && !error.message.includes("already exists")) {
      console.error("createBucket error:", error);
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "Missing url" }, { status: 400 });
    }

    let parsed: URL;
    try {
      parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return NextResponse.json({ error: "Invalid protocol" }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    // 1. Fetch video (server-side → no CORS)
    const fetchRes = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "*/*",
        Referer: "https://www.tiktok.com/",
      },
      cache: "no-store",
    });

    if (!fetchRes.ok) {
      return NextResponse.json(
        { error: `Cannot fetch video: ${fetchRes.status}` },
        { status: 502 }
      );
    }

    const contentType = fetchRes.headers.get("content-type") || "video/mp4";
    const arrayBuffer = await fetchRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const sizeMB = (buffer.length / (1024 * 1024)).toFixed(2);

    if (buffer.length > 95 * 1024 * 1024) {
      return NextResponse.json(
        { error: `File too large (${sizeMB} MB). Max ~95MB.` },
        { status: 413 }
      );
    }

    // 2. Upload to Supabase Storage
    const supabase = getAdmin();
    await ensureBucket(supabase);

    const id = randomUUID();
    const ext = contentType.includes("webm")
      ? "webm"
      : contentType.includes("quicktime")
      ? "mov"
      : "mp4";
    const path = `${id}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("videos")
      .upload(path, buffer, {
        contentType,
        upsert: false,
        cacheControl: "public, max-age=31536000",
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json(
        { error: uploadError.message || "Upload to Supabase failed" },
        { status: 500 }
      );
    }

    // Public URL from Supabase (may still have CORS issues from browser)
    const { data: publicData } = supabase.storage.from("videos").getPublicUrl(path);
    const supabasePublicUrl = publicData.publicUrl;

    // Our own CORS-friendly view URL on this domain
    const host = req.headers.get("host") || "tiktokdl-self.vercel.app";
    const protocol = host.includes("localhost") ? "http" : "https";
    const viewUrl = `${protocol}://${host}/api/v/${id}.${ext}`;

    return NextResponse.json({
      success: true,
      id,
      filename: path,
      sizeMB,
      contentType,
      // Link dùng domain đang deploy + đã gắn CORS
      viewUrl,
      // Link gốc Supabase (backup)
      supabaseUrl: supabasePublicUrl,
      message: "Video đã lưu lên Supabase. Dùng viewUrl để xem (có CORS).",
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
