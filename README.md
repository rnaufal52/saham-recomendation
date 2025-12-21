# 🚀 Rnaufal Antigravity Scalper (IDX Edition)

**"Sistem Trading Harian berbasis AI untuk Saham Indonesia (IDX)"**

Project ini bukan sekadar "Signal Generator", melainkan sebuah **Decision Engine** yang menggabungkan filter teknikal ketat dengan kecerdasan buatan (LLM) untuk mencari peluang *scalping* (1-15 menit) dengan probabilitas tinggi.

---

## 🧠 Filosofi Sistem: "Antigravity"
Sistem ini didesain dengan prinsip **Capital Preservation First**.
1.  **Scanner Logic (The Hunter)**: Memfilter 800+ saham menjadi Top 40 berdasarkan Volume & Change %.
2.  **Analyst AI (The Brain)**: Menganalisa struktur market (Momentum & Reversal) secara mendalam.
3.  **Risk Manager (The Boss)**: Menghitung resiko. Jika trade tidak "Sempurna", sistem akan memilih **WAIT**.

> **"Missing profit is better than losing capital."**

---

## 🛠️ Tech Stack
-   **Runtime**: Node.js & TypeScript
-   **Framework**: Express.js (API & Static Serving)
-   **AI Engine**: Groq (Llama-3-70b-versatile) - *Ultra Fast Inference*
-   **Frontend**: Native TypeScript SPA + TailwindCSS (Glassmorphism UI)
-   **Security**: Helmet, Rate Limiting, Strict Input Validation

---

## ⚙️ Instalasi & Setup

### 1. Clone & Install
```bash
git clone https://github.com/rnaufal/api-recomendation-saham.git
cd api-recomendation-saham
npm install
```

### 2. Konfigurasi Environment (.env)
Buat file `.env` di root folder dan isi sesuai kebutuhan:
```env
# Server Config
PORT=3002
NODE_ENV=development  # Set 'production' saat live (hanya scan jam 09-16)

# Groq AI Keys (Get free at console.groq.com)
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxx
GROQ_MODEL=llama-3.3-70b-versatile

# Scanner Thresholds (Antigravity Rules)
SCANNER_MIN_VOLUME=5000       # Min volume lot
SCANNER_MIN_CHANGE=0.2        # Min kenaikan 0.2%
SCANNER_TOP_LIMIT=40          # Ambil 40 saham teraktif untuk dianalisa AI
```

### 3. Jalankan Aplikasi
**Mode Development (Auto Restart):**
```bash
npm run dev
```
**Mode Production (Build & Run):**
```bash
npm run build
npm start
```
*Catatan: Di mode Production, sistem hanya aktif scanning pada jam **09:00 - 16:00 WIB**.*
Buka browser di: `http://localhost:3002`

---

## 📊 Cara Membaca Dashboard

Sistem akan menampilkan kartu sinyal **HANYA** jika setup valid ditemukan. Pastikan untuk selalu cek **Riwayat Sinyal** di bagian bawah dashboard jika kartu utama kosong (karena *cooldown*).

| Indikator | Penjelasan |
| :--- | :--- |
| **ENTRY** | Area harga beli ideal (Bid Price). Jangan HK jika harga sudah lari > 2%. |
| **TARGET** | Target jual rasional (+2% s/d +5%). Scalping style. |
| **STOP** | Titik CL wajib. Jika harga sentuh ini, segera buang. |
| **CONFIDENCE** | Nilai keyakinan AI (0-100). Fokus pada skor **> 85**. |

---

## 🛡️ Fitur Keamanan & Resiko
1.  **Dual-Layer Prompting**: AI bekerja dengan mode "Internal Monologue" (Berpikir dulu sebelum menjawab) untuk mengurangi halusinasi.
2.  **Strict Filters**: Saham dengan spread lebar atau resiko tinggi otomatis dibuang oleh logika Typescript (bukan AI).
3.  **Cooldown System**: Jika saham `BBRI` baru saja direkomendasikan, sistem akan "melupakan" saham tersebut selama **15 menit** agar tidak spamming.

---

## ⚠️ Disclaimer
Project ini adalah alat bantu analisa (Assistant), bukan penasihat keuangan. Keputusan jual/beli tetap ada di tangan Anda.
**Do Your Own Research (DYOR).**

---
© 2025 Rnaufal Engine.
