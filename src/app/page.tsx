"use client";

import { useState, useRef } from "react";

const MAX_MB = 200;
const MAX_BYTES = MAX_MB * 1024 * 1024;

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File | null) => {
    setResult(null);
    setError(null);
    setProgress(0);
    if (!f) {
      setFile(null);
      return;
    }
    if (!f.type.startsWith("video/") && !f.name.match(/\.(mp4|webm|mov|mkv|avi)$/i)) {
      setError("Chỉ chấp nhận file video (mp4, webm, mov...)");
      setFile(null);
      return;
    }
    if (f.size > MAX_BYTES) {
      setError(`File quá lớn (tối đa ${MAX_MB}MB). File hiện tại: ${(f.size / 1024 / 1024).toFixed(1)}MB`);
      setFile(null);
      return;
    }
    setFile(f);
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Vui lòng chọn file video");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setProgress(0);

    try {
      // 1) Lấy signed upload URL từ server
      const metaRes = await fetch("/api/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || "video/mp4",
          size: file.size,
        }),
      });

      const text = await metaRes.text();
      let meta: any;
      try {
        meta = JSON.parse(text);
      } catch {
        throw new Error(
          metaRes.status === 413
            ? "File quá lớn so với giới hạn server"
            : `Lỗi server (${metaRes.status}): ${text.slice(0, 120)}`
        );
      }

      if (!metaRes.ok) {
        throw new Error(meta.error || "Không tạo được upload URL");
      }

      // 2) Upload thẳng lên Supabase bằng signed URL (không qua Vercel body)
      setProgress(10);

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", meta.signedUrl);
        xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
        // Supabase signed upload often expects this header with the token
        if (meta.token) {
          xhr.setRequestHeader("x-upsert", "false");
        }

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round(10 + (e.loaded / e.total) * 85);
            setProgress(pct);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(
              new Error(
                `Upload Supabase thất bại (${xhr.status}): ${xhr.responseText?.slice(0, 150) || "unknown"}`
              )
            );
          }
        };
        xhr.onerror = () => reject(new Error("Lỗi mạng khi upload lên Supabase"));
        xhr.send(file);
      });

      setProgress(100);

      setResult({
        success: true,
        filename: meta.path,
        originalName: file.name,
        sizeMB: (file.size / 1024 / 1024).toFixed(2),
        viewUrl: meta.viewUrl,
        supabaseUrl: meta.supabaseUrl,
        message: "Video đã upload lên Supabase. Dùng viewUrl để xem (có CORS).",
      });
    } catch (err: any) {
      setError(err.message || "Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      <header className="border-b border-[#222] py-5">
        <div className="max-w-2xl mx-auto px-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-cyan-400 flex items-center justify-center font-bold text-lg">
            DL
          </div>
          <div>
            <h1 className="text-xl font-bold">TikTokDL</h1>
            <p className="text-xs text-gray-400">
              Upload file (tối đa {MAX_MB}MB) • Supabase • Link CORS
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-12">
        <div className="bg-[#141414] border border-[#262626] rounded-2xl p-6 space-y-5">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) handleFile(f);
            }}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition ${
              dragOver
                ? "border-pink-500 bg-pink-500/10"
                : "border-[#333] hover:border-[#555] bg-[#0a0a0a]"
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept="video/*,.mp4,.webm,.mov,.mkv"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] || null)}
            />
            {file ? (
              <div className="space-y-2">
                <p className="text-green-400 font-medium">✓ Đã chọn file</p>
                <p className="text-sm text-gray-300 break-all">{file.name}</p>
                <p className="text-xs text-gray-500">
                  {(file.size / (1024 * 1024)).toFixed(2)} MB • {file.type || "video"}
                </p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFile(null);
                    if (inputRef.current) inputRef.current.value = "";
                  }}
                  className="text-xs text-red-400 hover:underline mt-2"
                >
                  Xóa file
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-gray-300 font-medium">Kéo thả video vào đây</p>
                <p className="text-sm text-gray-500">hoặc bấm để chọn file từ máy</p>
                <p className="text-xs text-gray-600">mp4, webm, mov • tối đa {MAX_MB}MB</p>
              </div>
            )}
          </div>

          <button
            onClick={handleUpload}
            disabled={loading || !file}
            className="w-full py-3.5 rounded-xl font-semibold bg-gradient-to-r from-pink-500 to-cyan-400 hover:opacity-90 disabled:opacity-50 transition"
          >
            {loading ? `Đang upload... ${progress}%` : "Upload video"}
          </button>

          {loading && (
            <div className="w-full h-2 bg-[#222] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-pink-500 to-cyan-400 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          {error && (
            <div className="text-sm text-red-400 bg-red-950/40 border border-red-900 rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          {result && (
            <div className="bg-[#0a0a0a] border border-green-900/50 rounded-xl p-4 space-y-3 text-sm">
              <p className="text-green-400 font-medium">✅ {result.message}</p>
              <p>
                <span className="text-gray-400">File gốc:</span> {result.originalName}
              </p>
              <p>
                <span className="text-gray-400">Size:</span> {result.sizeMB} MB
              </p>

              <div className="space-y-1">
                <p className="text-gray-400">Link xem (có CORS):</p>
                <div className="flex gap-2 items-start">
                  <a
                    href={result.viewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-400 hover:underline break-all flex-1"
                  >
                    {result.viewUrl}
                  </a>
                  <button
                    onClick={() => copy(result.viewUrl)}
                    className="shrink-0 px-3 py-1 rounded-lg bg-[#262626] hover:bg-[#333] text-xs"
                  >
                    Copy
                  </button>
                </div>
              </div>

              {result.viewUrl && (
                <video
                  src={result.viewUrl}
                  controls
                  className="w-full rounded-xl mt-2 max-h-64 bg-black"
                />
              )}
            </div>
          )}
        </div>

        <div className="mt-8 text-center text-xs text-gray-500 space-y-1">
          <p>Upload thẳng lên Supabase (không qua Vercel body) → hỗ trợ tới {MAX_MB}MB</p>
          <p>
            Link <code className="text-gray-400">/api/v/...</code> gắn{" "}
            <code className="text-gray-400">Access-Control-Allow-Origin: *</code>
          </p>
        </div>
      </main>

      <footer className="border-t border-[#222] py-4 text-center text-xs text-gray-600">
        TikTokDL • Direct Supabase upload • Max {MAX_MB}MB • CORS viewer
      </footer>
    </div>
  );
}
