# GlyphCraft — Handwriting Font Maker

Prototype website responsive untuk menggambar karakter A–Z, a–z, angka, simbol, lalu mengekspornya menjadi font.

## Menjalankan

Karena aplikasi memakai JavaScript module dari CDN, jalankan lewat local server (bukan sekadar double-click `index.html`).

Contoh:

```bash
python -m http.server 8080
```

Lalu buka `http://localhost:8080`.

Atau pakai VS Code + extension Live Server.

## Fitur

- Drawing canvas dengan mouse, stylus, dan touch
- Template huruf transparan + font guide
- A–Z, a–z, 0–9, simbol/tanda baca
- Undo, clear, eraser, brush size
- Autosave ke localStorage
- Progress karakter
- Live font preview
- Light / dark mode
- Responsive desktop & mobile
- Export OTF
- Konversi OTF → TTF di browser
- Tidak mengunggah gambar tulisan ke server

## Catatan teknis

- OTF dibuat dengan `opentype.js`.
- TTF dibuat dengan mengonversi hasil OTF menggunakan `fonteditor-core`.
- Goresan freehand diubah menjadi outline polygon sebelum dimasukkan sebagai glyph.
- Ini MVP front-end. Untuk kualitas font produksi, tahap berikutnya idealnya menambah:
  - contour union / overlap removal,
  - Bézier smoothing lebih canggih,
  - kerning editor,
  - side-bearing per glyph,
  - accent/diacritics,
  - hinting,
  - project export/import.

## File

- `index.html` — struktur UI
- `style.css` — responsive UI + dark mode
- `app.js` — drawing, autosave, preview, font generation/export
