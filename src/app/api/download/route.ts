import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const REPO_OWNER = "ontopcommunity";
const REPO_NAME = "tiktokdl";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "Missing url" }, { status: 400 });
    }

    // Validate URL
    let parsed: URL;
    try {
      parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return NextResponse.json({ error: "Invalid protocol" }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    // 1. Fetch the video (server-side = no CORS)
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
        { error: `Cannot fetch video: ${fetchRes.status} ${fetchRes.statusText}` },
        { status: 502 }
      );
    }

    const contentType = fetchRes.headers.get("content-type") || "video/mp4";
    const arrayBuffer = await fetchRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const sizeMB = (buffer.length / (1024 * 1024)).toFixed(2);

    if (buffer.length > 45 * 1024 * 1024) {
      return NextResponse.json(
        { error: `File too large (${sizeMB} MB). Max ~45MB for GitHub Contents API.` },
        { status: 413 }
      );
    }

    // 2. Upload to GitHub repo
    if (!GITHUB_TOKEN) {
      return NextResponse.json(
        { error: "GITHUB_TOKEN not configured on server" },
        { status: 500 }
      );
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const ext = contentType.includes("webm")
      ? "webm"
      : contentType.includes("quicktime")
      ? "mov"
      : "mp4";
    const filename = `video_${timestamp}.${ext}`;
    const path = `downloads/${filename}`;

    const base64Content = buffer.toString("base64");

    const uploadRes = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`,
      {
        method: "PUT",
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: `Download video: ${filename} (${sizeMB} MB)`,
          content: base64Content,
          branch: "main",
        }),
      }
    );

    const uploadData = await uploadRes.json();

    if (!uploadRes.ok) {
      console.error("GitHub upload error:", uploadData);
      return NextResponse.json(
        {
          error: uploadData.message || "Failed to upload to GitHub",
          details: uploadData,
        },
        { status: 500 }
      );
    }

    const downloadUrl =
      uploadData.content?.download_url ||
      `https://github.com/${REPO_OWNER}/${REPO_NAME}/blob/main/${path}`;

    return NextResponse.json({
      success: true,
      filename,
      path,
      sizeMB,
      githubUrl: downloadUrl,
      htmlUrl: uploadData.content?.html_url,
      message: "Video đã được tải và lưu vào GitHub repo",
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
