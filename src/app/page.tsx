"use client";

import { useState, useRef } from "react";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File | null) => {
    setResult(null);
    setError(null);
    if (!f) {
      setFile(null);
      return;
    }
    if (!f.type.startsWith("video/") && !f.name.match(/\.(mp4|webm|mov|mkv|avi)$/i)) {
      setError("Chỉ chấp nhận file video (mp4, webm, mov...)");
      setFile(null);
      return;
    }
    if (f.size > 95 * 1024 * 1024) {
      setError("File quá lớn (tối đa ~95MB)");
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

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/download", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Upload failed");
      }

      setResult(data);
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
              Upload file video • Lưu Supabase • Link xem có CORS
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-12">
        <div className="bg-[#141414] border border-[#262626] rounded-2xl p-6 space-y-5">
          {/* Drop zone */}
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
                <p className="text-xs text-gray-600">mp4, webm, mov • tối đa ~95MB</p>
              </div>
            )}
          </div>

          <button
            onClick={handleUpload}
            disabled={loading || !file}
            className="w-full py-3.5 rounded-xl font-semibold bg-gradient-to-r from-pink-500 to-cyan-400 hover:opacity-90 disabled:opacity-50 transition"
          >
            {loading ? "Đang upload lên Supabase..." : "Upload video"}
          </button>

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
                <p className="text-gray-400">Link xem (có CORS – dùng domain này):</p>
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
          <p>Video lưu trên Supabase Storage (bucket: videos)</p>
          <p>
            Link <code className="text-gray-400">/api/v/...</code> đã gắn{" "}
            <code className="text-gray-400">Access-Control-Allow-Origin: *</code>
          </p>
          <p>Website khác có thể fetch / embed link này mà không bị CORS</p>
        </div>
      </main>

      <footer className="border-t border-[#222] py-4 text-center text-xs text-gray-600">
        TikTokDL • Upload file • Supabase • CORS viewer
      </footer>
    </div>
  );
}
