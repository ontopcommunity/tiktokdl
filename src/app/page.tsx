"use client";

import { useState } from "react";

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    if (!url.trim()) {
      setError("Vui lòng nhập link video");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Download failed");
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message || "Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
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
            <p className="text-xs text-gray-400">Bypass CORS • Download • Save to GitHub</p>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-12">
        <div className="bg-[#141414] border border-[#262626] rounded-2xl p-6 space-y-5">
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Link video (TikTok CDN, direct MP4, hoặc bất kỳ URL video nào)
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://v16-notes.tiktokcdn-us.com/....mp4"
              className="w-full bg-[#0a0a0a] border border-[#333] rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:border-pink-500 transition"
            />
          </div>

          <button
            onClick={handleDownload}
            disabled={loading}
            className="w-full py-3.5 rounded-xl font-semibold bg-gradient-to-r from-pink-500 to-cyan-400 hover:opacity-90 disabled:opacity-50 transition"
          >
            {loading ? "Đang tải & lưu vào GitHub..." : "Tải video về GitHub"}
          </button>

          {error && (
            <div className="text-sm text-red-400 bg-red-950/40 border border-red-900 rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          {result && (
            <div className="bg-[#0a0a0a] border border-green-900/50 rounded-xl p-4 space-y-2 text-sm">
              <p className="text-green-400 font-medium">✅ {result.message}</p>
              <p>
                <span className="text-gray-400">File:</span> {result.filename}
              </p>
              <p>
                <span className="text-gray-400">Size:</span> {result.sizeMB} MB
              </p>
              <p>
                <span className="text-gray-400">Path:</span> {result.path}
              </p>
              {result.githubUrl && (
                <a
                  href={result.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-2 text-cyan-400 hover:underline break-all"
                >
                  → Xem / Tải trên GitHub
                </a>
              )}
              {result.htmlUrl && (
                <a
                  href={result.htmlUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-gray-400 hover:underline text-xs break-all"
                >
                  {result.htmlUrl}
                </a>
              )}
            </div>
          )}
        </div>

        <div className="mt-8 text-center text-xs text-gray-500 space-y-1">
          <p>Video sẽ được lưu vào thư mục <code className="text-gray-400">downloads/</code> của repo</p>
          <p>Repo: <a href="https://github.com/ontopcommunity/tiktokdl" className="text-pink-400 hover:underline" target="_blank">ontopcommunity/tiktokdl</a></p>
          <p className="pt-2">Giới hạn ~45MB / file (GitHub Contents API)</p>
        </div>
      </main>

      <footer className="border-t border-[#222] py-4 text-center text-xs text-gray-600">
        TikTokDL • CORS Bypass • GitHub Storage
      </footer>
    </div>
  );
}
