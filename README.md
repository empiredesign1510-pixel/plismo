# GlyphCraft Studio v2

Upgrade besar dari MVP Font Maker. Aplikasi berjalan di browser dan menyimpan project secara lokal.

## Fitur yang sudah direalisasikan

### Drawing & brush
- 8 brush preset:
  - Monoline
  - Marker
  - Brush Pen (pressure-aware)
  - Fountain
  - Pencil
  - Chalk
  - Felt Tip
  - Calligraphy
- Pointer pressure disimpan bila stylus/browser mendukungnya.
- Undo, eraser, cleanup, normalize position.
- Stroke brush tersimpan per stroke.

### Template recreate library
- Clean Sans
- Retro 70s
- Slab Poster
- Western
- Editorial Serif
- Condensed Poster
- Casual Script
- Pixel Arcade
- Neon Line
- Filter kategori
- Upload font lokal sebagai custom visual reference

Template hanya GUIDE visual. Glyph hasil export selalu berasal dari goresan pengguna.

### Smart / quality tools
- Smart Stroke Cleanup (simplify + smoothing)
- Consistency Assistant:
  - baseline
  - proporsi
  - posisi center
  - konsistensi stroke
- Technical quality score
- Personality tags

### Alternate glyph
- Sampai 4 varian per karakter.
- Disimpan di project.
- V1 menjadi default export saat ini.

### Kerning Lab
- Pair editor untuk AV, To, Wa, Yo, Ta, LT, FA, PA.
- Nilai disimpan dan dicoba dimasukkan ke data kerning font export.

### Ligature Studio
- Library kombinasi ligature dan preview.
- Menyimpan kombinasi ke project.

**Batas MVP:** substitusi GSUB native belum dikompilasi ke font. Untuk fitur ligature/alternate acak lintas Photoshop, Word, browser, dll, gunakan compiler OpenType yang mendukung GSUB/feature tables secara penuh.

### Real-world preview
- Poster
- Chat
- Brand
- Note
- Story

### Scan Paper Mode
- Generate printable 87-character sheet.
- Import foto/scan.
- Threshold-based grid segmentation.
- Membuat pixel-glyph draft.

**Batas MVP:** perspective correction / computer vision calibration belum otomatis. Foto harus cukup lurus.

### Signature Mode
- Drawing signature.
- Export PNG transparan.
- Export SVG vector stroke.

### Project system
- Autosave localStorage
- Local projects
- Snapshot/version restore
- Export/import JSON

### Export
- OTF
- TTF (jika fonteditor-core berhasil mengonversi di browser)
- WOFF (jika converter mendukung)
- WOFF2 dicoba otomatis oleh converter
- Webfont ZIP:
  - font
  - CSS @font-face
  - demo HTML
- Standalone showcase HTML dengan font embedded
- Weight Lab: export static weight instances

**Batas MVP variable font:** slider weight menghasilkan static instances, bukan single native variable-font file dengan `wght` axis. Native variable font memerlukan compiler seperti fontTools/FontForge pipeline atau backend/WASM yang lebih lengkap.

## Menjalankan

Karena memakai ES modules dari CDN:

```bash
python -m http.server 8080
```

Lalu buka:

```text
http://localhost:8080
```

Atau gunakan VS Code Live Server.

## File utama

- `index.html`
- `style.css`
- `app.js`
- `README.md`

## Catatan penting produksi

Untuk menjadikannya produk font-engine production-grade, next technical layer idealnya:
1. true contour boolean union / overlap removal,
2. cubic Bézier fitting,
3. OpenType GSUB untuk contextual alternates dan ligature,
4. GPOS kerning,
5. native variable-font axes,
6. perspective correction + contour tracing pada Scan Paper,
7. diacritic/component builder,
8. hinting dan validation pipeline,
9. IndexedDB/cloud sync untuk project besar.


## Mobile UX v3

- Character list = drawer kiri.
- Font/property panel = drawer kanan.
- Bottom navigation = Character, Draw, Panel, Preview, Export.
- Semua fitur desktop tetap bisa diakses dari HP.
- Canvas toolbar memakai layout multi-row, bukan dipaksa satu baris.
- Brush picker tetap di dalam viewport.
- Modal besar menjadi full-height mobile sheet.
- Template/preview/assistant/kerning/scan/export punya layout mobile khusus.
- Mendukung safe-area pada iPhone/Android.
- Breakpoint ekstra untuk layar <=380px.

## Bugfix v3.1

Perbaikan stabilitas setelah mobile refactor:

- Menghapus deklarasi event drawer mobile yang terduplikasi dan dapat menghentikan seluruh JavaScript.
- Menambahkan fallback aman saat `localStorage` diblokir browser/preview environment.
- Font engine CDN sekarang dimuat secara dinamis; kegagalan jaringan tidak lagi mematikan editor utama.
- Memperkuat migrasi data alternate glyph agar array variant kosong tidak menyebabkan crash.
- Menambahkan fallback untuk browser yang tidak memiliki `HTMLDialogElement.showModal()` penuh.
- Mencegah state project tersimpan tertimpa saat proses hydration theme.
- Memastikan semua ID DOM yang direferensikan JavaScript tersedia.
- Smoke-tested pada viewport 360×800, 390×844, 430×932, 768×1024, dan 1366×768 tanpa horizontal overflow.
