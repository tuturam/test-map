# Source Code Explanation

Ini adalah aplikasi web **pencari rute lari/sepeda** berbasis peta. Secara sederhana: kamu masukkan lokasi → aplikasi bangkitin 3 opsi rute → ditampilkan di peta beserta statistik dan elevasinya.

---

## 1. Tech Stack

| Teknologi | Fungsi |
|-----------|--------|
| **Vue 3** (`<script setup>`) | Framework UI |
| **TypeScript** | Type safety |
| **Vite** | Build tool & dev server |
| **MapTiler SDK** | Menampilkan peta, geocoding (cari lokasi), dan elevasi |
| **OSRM (Project OSRM)** | Backend routing gratis untuk menghitung rute jalan |
| **Tailwind-like CSS custom** | Styling (pakai CSS variables, BEM-like class) |

---

## 2. Struktur Folder

```
src/
├── main.ts                        # Entry point Vue
├── App.vue                        # Root component — "pemilik" semua state global
├── style.css                      # Semua styling aplikasi
├── components/
│   ├── Map.vue                    # Komponen peta (MapTiler)
│   ├── RouteSearch.vue            # Form input: lokasi, mode, jarak
│   └── RouteOptions.vue           # Daftar 3 rute hasil generate + elevasi chart
├── composables/
│   ├── useGeocode.ts              # Logic cari lokasi via geocoding MapTiler
│   └── useRouteGenerator.ts       # Logic bangkitin 3 rute berbeda
├── types/
│   └── route.ts                   # Semua tipe data (RouteOption, GeneratePayload, dll)
└── utils/
    ├── osrm.ts                    # HTTP client ke server OSRM
    ├── math.ts                    # Perhitungan geografi (haversine, bearing, destination point)
    └── elevation.ts               # Ambil data elevasi dari MapTiler + hitung gain/loss
```

---

## 3. Alur Data (Data Flow)

```
User input (lokasi + mode + jarak)
         │
         ▼
RouteSearch.vue  ──emit("generate", payload)──▶  App.vue
                                                      │
                                        resolveStartPoint(payload)
                                        ├── pakai GPS (getCurrentPosition)
                                        └── pakai geocoding search
                                                      │
                                        generateRoutes(payload, center)
                                                      │
                                                      ▼
                                          3x waypoint sets dibuat (sudut berbeda)
                                                      │
                                        OSRM di-call untuk setiap set
                                                      │
                                        Hitung jarak aktual, iterasi kalau belum pas
                                                      │
                                        Ambil elevasi (MapTiler)
                                                      │
                                                      ▼
                                          RouteOption[] (3 rute)
                                                      │
                                        selectedRoute = opsi yang diklik
                                                      │
                                                      ▼
                                          Map.vue gambar garis rute di peta
                                          RouteOptions.vue tampilkan kartu
```

---

## 4. Penjelasan Setiap File

### `main.ts`

- Bootstrap Vue: `createApp(App).mount('#app')`
- Import CSS: `tokens.css` (design tokens) + `style.css`

---

### `App.vue` — Otak Aplikasi

Ini adalah **parent component** yang menyimpan semua state global.

**State penting:**

- `loading` — sedang generate rute?
- `error` — pesan error jika gagal
- `options` — array `RouteOption[]` hasil generate
- `selectedId` — ID rute yang sedang dipilih user
- `locationLabel` — label lokasi awal ("My position" atau nama kota)

**Fungsi `handleGenerate(payload)`:**

1. Reset state, set loading true
2. `resolveStartPoint()` — cari koordinat awal:
   - Kalau pakai GPS → `navigator.geolocation.getCurrentPosition`
   - Kalau pakai search → `geocodeForward()` ke MapTiler
3. `generateRoutes()` — bangkitin 3 opsi rute
4. Tangkap error & ubah jadi pesan UI yang ramah (`toErrorMessage`)

---

### `components/RouteSearch.vue` — Form Input

Komponen form yang mengumpulkan parameter dari user:

- **Location**: input teks atau tombol GPS
- **Start mode**: Direct (mulai dari titik yang sama) vs Radius (mulai dari titik sekitar)
- **Anchor radius**: 2 / 3 / 5 km (untuk mode radius)
- **Route type**: Loop (putar balik ke start) vs Linear (cuma sekali jalan)
- **Mode**: Footing (lari) vs Cycling (sepeda)
- **Distance**: 3K, 5K, 10K, atau custom

Meng-`emit` event `generate` dengan payload berisi semua setting ini.

---

### `components/Map.vue` — Peta

- Inisialisasi **MapTiler Map** dengan style gelap (`MapStyle.STREETS.DARK`)
- Center default: geocode "batam" (hardcoded, sepertinya sementara)
- **`renderRoute(route)`**: gambar 3 layer ke peta:
  1. Garis rute (line, warna oranye `#e4572e`)
  2. Titik awal (circle oranye dengan stroke gelap)
  3. Titik akhir (untuk linear route)
  4. `fitBounds()` agar peta zoom pas ke rute
- Watch `props.route` → render ulang otomatis kalau rute berubah

---

### `components/RouteOptions.vue` — Daftar Rute

Menampilkan kartu-kartu rute hasil generate:

- **Loading state**: 3 skeleton cards
- **Error state**: pesan error
- **Hasil**: kartu per rute dengan:
  - Arah rute (North, Northeast, dst)
  - Jarak & estimasi waktu
  - Elevasi gain/loss
  - Chart elevasi kecil (SVG polyline) — dihitung dari `chartPoints()`
- Klik kartu → emit `select` event → set `selectedId` di App.vue

---

### `composables/useGeocode.ts`

- `geocodeForward(query)` → panggil MapTiler Geocoding API → return `{ center, label }`
- `getCurrentPosition()` → wrapper `navigator.geolocation` → return `[lng, lat]`

---

### `composables/useRouteGenerator.ts` — Fungsi Utama

**`generateRoutes(payload, center)`** — entry point:

1. `buildDiverseWaypoints()` → buat 3 set waypoint dengan sudut berbeda (0°, 40°, 80°)
2. Untuk setiap set, panggil `buildOption()` paralel (`Promise.all`)
3. Filter yang null, return `RouteOption[]`

**`buildOption()`** — buat 1 rute:

- Coba 2 kali (`attempt 0` dan `attempt 1`) untuk mendekati jarak target
- Hitung `scale` kalau jarak OSRM belum pas dengan target
- `osrmRoute()` kirim koordinat ke OSRM → dapat GeoJSON + jarak aktual
- `attachElevation()` → ambil elevasi dari MapTiler
- Return `RouteOption` lengkap

**`buildDiverseWaypoints()`**:

- Buat 3 set waypoint dengan sudut berbeda (0°, 40°, 80°)
- Pastikan tiap set punya jarak minimum 1.5 km dari set lain (supaya rute tidak sama)

**`makeWaypoints()`**:

- **Linear**: 1 waypoint di arah tertentu, jarak ~80% target
- **Loop**: 3 waypoint membentuk segitiga di sekitar center

---

### `utils/osrm.ts` — HTTP Client ke OSRM

- Base URL: `https://router.project-osrm.org`
- `osrmRoute(profile, coords)`:
  - Format coords jadi string `lng,lat;lng,lat;...`
  - GET `/route/v1/{profile}/{path}?geometries=geojson&overview=full`
  - Return `{ geojson, distanceKm }`
- `fetchWithTimeout()`: fetch dengan `AbortController` timeout 6 detik
- `RoutingError`: custom error class dengan kode `no-route`, `timeout`, `network`, `server`

---

### `utils/math.ts` — Geografi & Geometri

- `haversineKm(a, b)` — jarak bumi antara 2 koordinat (rumus haversine)
- `destinationPoint(center, bearing, distance)` — hitung koordinat tujuan dari titik awal + arah + jarak
- `bearingDeg(a, b)` — arah derajat dari a ke b
- `cardinalDirection(bearing)` — ubah derajat jadi teks ("North", "Southeast", dst)
- `centroid(points)` — rata-rata koordinat
- `computeBounds(coords)` — bounding box dari koordinat
- `generateLoopWaypoints()` — buat 3 titik segitiga acak di sekitar center
- `generateLinearWaypoint()` — buat 1 titik di arah acak

---

### `utils/elevation.ts`

- `attachElevation(geojson)` — kirim LineString ke MapTiler Elevation API → dapat koordinat dengan altitude
- `computeElevationStats(coords)` — hitung total naik (gain) dan turun (loss) dari sekumpul koordinat ber-altitude

---

## 5. Bagaimana OSRM Bekerja Secara Singkat

OSRM adalah engine routing open-source yang sudah di-hosting publik di `router.project-osrm.org`.

Kamu kirim: **"Hitung rute dari A → B → C → A untuk mobil/pejalan kaki/sepeda"**

OSRM balas: **"Ini jalannya (GeoJSON), panjangnya X km, waktu Y menit"**

Aplikasi ini menggunakan OSRM untuk menghitung jarak **sesungguhnya** di jalan, bukan jarak garis lurus (great circle).

---

## 6. Bagaimana Cara Menghasilkan 3 Rute yang Berbeda

Inilah bagian paling "kerjanya":

1. **Tentukan 3 sudut dasar**: 0°, 40°, 80°
2. **Untuk setiap sudut**:
   - Buat 3 waypoint dengan posisi bervariasi (disebut "slot" 0, 1, 2)
   - Loop = 3 titik segitiga, Linear = 1 titik
3. **Kirim ke OSRM** untuk dapat rute jalan yang sebenarnya
4. **Iterasi maksimal 2x** kalau jarak belum sesuai target (scale waypoint naik/turun)
5. **Filter** yang tidak menghasilkan rute valid
6. **Ambil elevasi** untuk yang lolos

Hasilnya: 3 rute dengan karakter berbeda (misal: rute 1 ke Utara, rute 2 ke Timur Laut, rute 3 ke Timur).

---

## 7. Catatan Penting

- **API Key MapTiler** disimpan di environment variable `VITE_MAPTILER_API_KEY` (file `.env`)
- **OSRM public API** punya rate limit — untuk production sebaiknya self-host OSRM
- Default center map hardcoded ke "batam" di `Map.vue`
- Estimasi waktu dihitung pakai pacing: 6 menit/km untuk lari, 4 menit/km untuk sepeda
