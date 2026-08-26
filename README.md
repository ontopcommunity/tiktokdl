# TikTokDL

Simple video downloader that bypasses CORS and saves the file directly into this GitHub repository (`downloads/` folder).

## Features
- Paste any direct video URL (TikTok CDN links work well)
- Server-side fetch (no CORS issues)
- Auto upload to GitHub repo via Contents API
- Dark simple UI

## Limits
- ~45MB max per file (GitHub Contents API practical limit)
- Requires `GITHUB_TOKEN` env on Vercel

## Deploy
Vercel project: tiktokdl
