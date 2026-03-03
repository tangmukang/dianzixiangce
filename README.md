# 电子相册（手机优先）

功能包含：

- 3D 立体翻页
- 手势拖拽控制（可半翻停住、可回翻）
- 页角轻微弯曲效果
- 翻页声音（有 `assets/page-flip.mp3` 用真实音频；没有则用 WebAudio 回退）

## 项目结构

```text
.
├── index.html
├── styles.css
├── app.js
└── assets
    ├── page-flip.mp3          # optional, recommended for realistic sound
    └── photos
        ├── 01.svg ... 08.svg  # sample photos
        └── fallback.svg
```

## 替换成你自己的照片

1. Put your photo files into `assets/photos/`.
2. Edit `app.js` and update the `albumPhotos` array at the top:

```js
const albumPhotos = [
  { src: "assets/photos/your-01.jpg", title: "Title", date: "2026.03" },
  { src: "assets/photos/your-02.jpg", title: "Title", date: "2026.03" }
];
```

## 添加真实翻页音效

1. 把音频文件放到 `assets/page-flip.mp3`。
2. 建议时长 `0.2s - 0.5s`，音质尽量高。

如果没有这个文件，页面会自动使用生成音效兜底。

## 本地运行

直接双击 `index.html` 用浏览器打开即可，或使用任意静态服务器。

## Vercel 部署

这是纯静态网站，可直接从 GitHub 仓库导入部署：

1. 把本目录文件推送到 GitHub。
2. 在 Vercel 中导入该仓库。
3. Framework Preset 选 `Other`。
4. Build Command 留空。
5. Output Directory 留空。
6. 点击 Deploy。

Vercel 会自动把 `index.html` 作为入口页面。
