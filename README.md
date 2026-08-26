# TikTokDL

Upload video (bypass CORS) → lưu Supabase Storage → trả về link xem trên domain hiện tại (đã gắn CORS `*`).

## Flow
1. Client gửi link video
2. Server fetch (không bị CORS)
3. Upload vào Supabase bucket `videos`
4. Trả về `viewUrl` dạng `https://your-domain/api/v/{id}.mp4`
5. Route `/api/v/[id]` stream video + header CORS đầy đủ → website khác đọc được

## Env (Vercel)
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- NEXT_PUBLIC_SUPABASE_URL (optional)
- NEXT_PUBLIC_SUPABASE_ANON_KEY (optional)

## Limits
- ~95MB / file
