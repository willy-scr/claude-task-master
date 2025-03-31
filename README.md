# Task Master CLI

CLI untuk manajemen tugas dengan integrasi Gemini AI.

## Fitur

- Pecah dokumen PRD menjadi tugas-tugas terukur
- Kelola dependensi tugas
- Gunakan AI untuk memecah tugas kompleks
- Analisis kompleksitas tugas
- Lacak status penyelesaian

## Prasyarat

- Node.js 18+
- API Key Gemini AI

## Instalasi

```bash
npm install -g claude-task-master
```

Atau jalankan secara lokal dengan:

```bash
npx claude-task-master <command>
```

## Konfigurasi

Buat file `.env` di direktori proyek Anda dan atur variabel-variabel berikut:

- `GEMINI_API_KEY`: API key Gemini Anda 
- `PERPLEXITY_API_KEY`: API key Perplexity untuk fitur berbasis penelitian (opsional)

Contoh .env:
```
GEMINI_API_KEY=your_gemini_api_key_here
PERPLEXITY_API_KEY=your_perplexity_api_key_here
```

## Penggunaan Dasar

```bash
# Inisialisasi proyek baru
task-master init

# Parse dokumen PRD
task-master parse-prd --input=requirements.txt

# Lihat semua tugas
task-master list

# Lihat tugas berikutnya yang harus dikerjakan
task-master next

# Lihat detail tugas tertentu
task-master show 1

# Pecah tugas menjadi subtask
task-master expand --id=1 --num=3

# Tandai tugas sebagai selesai
task-master set-status --id=1 --status=done
```

## API Keys

Untuk menggunakan Task Master CLI, Anda memerlukan:

1. **GEMINI_API_KEY** - Dapatkan dari [Google AI Studio](https://ai.google.dev/)
2. **PERPLEXITY_API_KEY** (opsional) - Untuk fitur berbasis penelitian

## Mengelola Dependensi

```bash
# Tambahkan dependensi
task-master add-dependency --id=3 --depends-on=2

# Hapus dependensi
task-master remove-dependency --id=3 --depends-on=2

# Validasi semua dependensi
task-master validate-dependencies
```

## Lisensi

MIT
