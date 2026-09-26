# GlyphCraft Studio v3.1 — Bugfix

Bug utama pada build mobile sebelumnya berasal dari event binding drawer yang terduplikasi. Karena variabel `const` mobile drawer dibuat lebih dari sekali pada scope yang sama, JavaScript dapat gagal dieksekusi dan halaman terlihat error/tidak responsif.

Build ini membersihkan binding tersebut dan menambah proteksi runtime:

1. UI drawing tidak tergantung keberhasilan CDN font engine.
2. localStorage memakai safe wrapper.
3. alternate glyph state divalidasi sebelum dipakai.
4. dialog memiliki fallback.
5. mobile drawer kiri/kanan tidak saling bertumpuk.
6. layout tidak overflow pada viewport yang diuji.

Catatan: export OTF/TTF/WOFF tetap memerlukan akses ke library font dari CDN saat fitur export pertama kali digunakan.
