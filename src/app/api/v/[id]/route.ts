import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 60;

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function getAdmin() {
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Strong CORS so other websites can embed / fetch this video
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Range, Content-Type, Authorization, Origin, Accept",
  "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges, Content-Type",
  "Access-Control-Max-Age": "86400",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id || id.includes("..") || id.includes("/")) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400, headers: corsHeaders });
    }

    const supabase = getAdmin();

    // Download from Supabase Storage
    const { data, error } = await supabase.storage.from("videos").download(id);

    if (error || !data) {
      console.error("Download error:", error);
      return NextResponse.json(
        { error: error?.message || "Video not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    const buffer = Buffer.from(await data.arrayBuffer());
    const contentType = data.type || "video/mp4";

    // Support Range requests for video seeking
    const range = req.headers.get("range");
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : buffer.length - 1;
      const chunk = buffer.subarray(start, end + 1);

      return new NextResponse(chunk, {
        status: 206,
        headers: {
          ...corsHeaders,
          "Content-Type": contentType,
          "Content-Length": String(chunk.length),
          "Content-Range": `bytes ${start}-${end}/${buffer.length}`,
          "Accept-Ranges": "bytes",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Content-Length": String(buffer.length),
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: err?.message || "Server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function HEAD(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const res = await GET(req, ctx);
  // Return headers only
  return new NextResponse(null, { status: res.status, headers: res.headers });
}
