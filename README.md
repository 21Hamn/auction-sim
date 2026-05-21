PROJECT MASIH DALAM STATUS PENGEMBANGAN (ALPHA VERSION)

# Untuk Cek Simulasinya Bisa Gunakan Link Berikut: (Sudah Bisa Multiplayer)
[https://auction-sim-1.onrender.com/](https://auction-sim-1.onrender.com/)

# 🔨 AuctionSim — Real-Time Multiplayer Bidding Platform

Platform simulasi lelang real-time berbasis WebSocket untuk hingga **30 peserta** dalam jaringan lokal maupun internet. Mendukung 4 jenis auction utama dengan analitik ekonomi lengkap.

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Jalankan server
npm start

# 3. Buka browser
# Lokal:   http://localhost:3000
# Network: http://<IP-Anda>:3000
```

---

## 📁 Struktur Folder

```
auction-sim/
├── package.json
├── README.md
│
├── server/
│   ├── server.js              # Main Express + Socket.IO server
│   ├── socket/
│   │   └── socketHandlers.js  # Semua event handler Socket.IO
│   └── utils/
│       ├── auctionEngine.js   # Kalkulasi ekonomi auction
│       ├── botManager.js      # Sistem AI bot bidder
│       └── roomManager.js     # Manajemen room & player
│
├── shared/
│   └── constants.js           # Konstanta shared server-client
│
└── client/
    └── public/
        ├── index.html         # Single-page application
        ├── css/
        │   └── main.css       # Styling lengkap (Bloomberg terminal aesthetic)
        └── js/
            ├── constants.js   # Client-side constants
            ├── state.js       # Global state management
            ├── socket.js      # Socket.IO event handling
            ├── ui.js          # UI rendering functions
            ├── auction.js     # Bidding actions
            ├── charts.js      # Chart.js visualizations
            ├── educational.js # Panel edukasi strategi
            └── app.js         # Entry point
```

---

## 🎮 Jenis Auction

### 📈 English Auction (Open Ascending)
- Harga naik secara real-time
- Semua peserta melihat bid tertinggi saat ini
- Fitur: Quick bid (+$100/500/1K), Auto-bid, Fold
- Timer reset setiap ada bid baru (opsional)
- **Strategi optimal**: Bid naik hingga valuasi pribadi

### 📉 Dutch Auction (Descending Price)
- Harga turun otomatis setiap beberapa detik
- Peserta pertama yang klik **BUY NOW** menang
- **Strategi optimal**: Beli ketika harga = (N-1)/N × valuasi
- Ekivalen strategis dengan First-Price Sealed

### 📋 First-Price Sealed-Bid
- Semua peserta submit bid rahasia
- Setelah timer habis, semua bid direveal
- Pemenang membayar bid mereka sendiri
- **Nash Equilibrium**: bid = (N-1)/N × valuasi

### 🔒 Vickrey / Second-Price Sealed (Vickrey)
- Pemenang adalah bidder tertinggi
- Membayar harga bid **tertinggi kedua**
- **Dominant strategy**: Bid true valuation
- Analisis: overbid, underbid, surplus

---

## 🧠 Fitur Ekonomi

### Private Value System
Setiap pemain mendapat **private valuation** yang berbeda:
- Komponen privat (nilai subjektif)
- Komponen common value (sinyal pasar bersama)
- Disesuaikan dengan risk profile pemain

### Winner's Curse Detection
Setelah setiap auction:
- Reveal true common value
- Kalkulasi apakah winner membayar lebih dari nilai sebenarnya
- Visualisasi profit/loss

### Analytics per Round
- **Efficiency**: Rasio valuasi pemenang vs valuasi tertinggi
- **Expected Revenue**: Prediksi teoritis pendapatan auctioneer
- **Nash Revenue**: Revenue pada Nash equilibrium
- **Bid Distribution**: Statistik sebaran bid
- **Bidder Surplus**: Keuntungan masing-masing bidder

### Revenue Equivalence Theorem
Platform menghitung dan membandingkan revenue aktual dengan prediksi teoritis untuk semua jenis auction.

---

## 🤖 AI Bot System

5 strategi bot berbeda:

| Bot | Strategi | Deskripsi |
|-----|----------|-----------|
| **Conservative** | Nash Equilibrium | Bid sesuai formula optimal |
| **Aggressive** | Overbid | Bid hingga 110% valuasi |
| **Sniper** | Last Second | Tunggu detik terakhir, lalu bid |
| **Irrational** | Random | Perilaku acak, simulasi bias kognitif |
| **Adaptive** | Learning | Belajar dari hasil sebelumnya |

Bot otomatis mengisi room jika peserta kurang dari target.

---

## 🎨 Tema Auction

| Tema | Emoji | Deskripsi | Price Range |
|------|-------|-----------|-------------|
| Fine Art | 🎨 | Lelang karya seni | $1K–$20K |
| Oil Field | 🛢️ | Hak pengeboran | $3K–$15K |
| Spectrum License | 📡 | Lisensi frekuensi radio | $5K–$25K |
| Startup Valuation | 🚀 | Investasi startup | $500–$50K |
| NFT Collection | 🖼️ | Digital collectibles | $100–$10K |
| Commodity Futures | 🌾 | Kontrak komoditas | $2K–$8K |

---

## 🎛️ Host Controls

Host room mendapat kontrol penuh:
- **Start/Stop** auction
- **Pause/Resume** timer
- **Inject Market News** — mempengaruhi valuasi semua pemain ±50%
- **Kick player** dari room
- **Ubah settings** sebelum setiap round

---

## 🌐 Multi-Player Setup (MASIH ADA BEBERAPA BUG)

### Jaringan Lokal (LAN)
```bash
npm start
# Server otomatis menampilkan IP jaringan:
# Network: http://192.168.x.x:3000
# Share URL ini ke semua peserta
```

### Internet (Port Forwarding)
```bash
# Forward port 3000 di router
# Atau gunakan ngrok:
npx ngrok http 3000
```

### Environment Variables
```bash
PORT=3000 npm start          # Ubah port
```

---

## 📊 Analitik Akhir (Per Round)

Setelah setiap round ditampilkan:
- 🏆 Pemenang + harga yang dibayar
- 📈 Chart: Bid vs Valuasi semua pemain
- 📊 Chart: Revenue comparison
- ⚖️ Efficiency score
- 🎯 Nash equilibrium approximation
- 💀 Winner's curse analysis
- 📋 Tabel semua bid direveal

---

## 🔧 Technical Details

- **Backend**: Node.js + Express + Socket.IO 4.x
- **Frontend**: Vanilla HTML/CSS/JS (no framework)
- **Database**: In-memory JSON (tidak butuh DB eksternal)
- **Visualisasi**: Chart.js 4.x
- **Kapasitas**: 30 concurrent players per room
- **Anti-spam**: 500ms cooldown antara bid
- **Reconnect**: Otomatis re-join session aktif

---

## 📱 Kompatibilitas

- ✅ Chrome, Firefox, Safari, Edge (modern)
- ✅ Mobile (responsive design)
- ✅ Tablet
- ✅ Desktop

---

## 🎓 Mode Edukasi

Panel **Strategy Guide** muncul otomatis di setiap auction berisi:
- Penjelasan mekanisme auction
- Strategi optimal
- Formula matematika (Nash equilibrium)
- Kalkulasi bid optimal berdasarkan valuasi Anda

---

## ⌨️ Keyboard Shortcuts (Auction Page)

| Key | Aksi |
|-----|------|
| `1` | Quick bid +$100 (English) |
| `2` | Quick bid +$500 (English) |
| `3` | Quick bid +$1,000 (English) |
| `F` | Fold (English) |
| `Space` / `B` | Buy Now (Dutch) |
| `Esc` | Tutup modal |

---

## 📝 Contoh Skenario Penggunaan

### Simulasi Pembelajaran Auction (30 Audiens)
1. Moderator buat room, bagikan kode
2. Pilih **Vickrey Auction** untuk demonstrasi dominant strategy
3. Aktifkan **Educational Mode**
4. Jalankan 3 round dengan tema berbeda
5. Bandingkan revenue semua jenis auction

### Game Night (10 Orang)
1. Buat room, botCount = 0
2. Pilih **English Auction** tema **NFT**
3. Setiap orang bid dengan strategi masing-masing
4. Lihat siapa yang paling banyak akumulasi balance setelah 5 round

---

*Built with Node.js, Socket.IO, Chart.js | Bloomberg Terminal Theme*
