# Gemini Task Master CLI

CLI untuk manajemen tugas dengan integrasi Gemini AI.

## Fitur

- Pecah dokumen PRD menjadi tugas-tugas terukur
- Kelola dependensi tugas
- Gunakan AI untuk memecah tugas kompleks
- Analisis kompleksitas tugas
- Lacak status penyelesaian
- Integrasi dengan Gemini AI untuk analisis cerdas
- Dukungan untuk penelitian dengan Perplexity (opsional)

## Prasyarat

- Node.js 18+
- Gemini API Key
- Perplexity API Key (opsional, untuk fitur penelitian)

## Instalasi

```bash
npm install -g gemini-task-master
```

Atau jalankan secara lokal dengan:

```bash
npx gemini-task-master <command>
```

## Konfigurasi

Buat file `.env` di direktori proyek Anda:

```env
GEMINI_API_KEY=your_gemini_api_key_here
PERPLEXITY_API_KEY=your_perplexity_api_key_here  # Opsional
```

## Struktur Proyek

Setelah menjalankan `init`, struktur folder akan terlihat seperti ini:

```
your-project/
├── .env
├── tasks/
│   ├── tasks.json        # Database tugas utama
│   └── task_*.txt        # File detail tugas individual
├── .cursor/
│   └── rules/           # Aturan dan panduan proyek
└── README.md
```

## Workflow Lengkap

1. **Inisialisasi Proyek**
   ```bash
   task-master init
   ```

2. **Generate Tasks dari PRD**
   ```bash
   task-master parse-prd --input=requirements.txt
   ```
   
   Format PRD yang didukung:
   ```markdown
   # Judul Fitur
   
   ## Deskripsi
   Jelaskan fitur secara detail...
   
   ## Persyaratan
   - Requirement 1
   - Requirement 2
   
   ## Kriteria Penerimaan
   - Kriteria 1
   - Kriteria 2
   ```

3. **Analisis Kompleksitas**
   ```bash
   # Dengan research
   task-master analyze-complexity --research
   
   # Tanpa research
   task-master analyze-complexity
   ```

4. **Pecah Task Kompleks**
   ```bash
   task-master expand --id=1 --num=3 --research
   ```

5. **Mulai Pengerjaan**
   ```bash
   # Lihat task berikutnya
   task-master next
   
   # Lihat detail task
   task-master show 1
   
   # Update status
   task-master set-status --id=1 --status=done
   ```

## Best Practices

1. **Manajemen Task**
   - Mulai dari task dengan dependensi minimal
   - Pecah task kompleks menjadi subtask
   - Update status secara rutin
   - Validasi dependensi secara berkala

2. **Penggunaan AI**
   - Gunakan flag `--research` untuk analisis mendalam
   - Manfaatkan Gemini untuk breakdown task
   - Review dan adjust hasil AI sesuai kebutuhan

3. **Tim Workflow**
   - Sinkronkan tasks.json ke version control
   - Review perubahan task bersama tim
   - Gunakan branch untuk fitur berbeda

## Troubleshooting

1. **API Rate Limits**
   ```bash
   # Tunggu beberapa saat dan coba lagi
   task-master retry --id=last
   ```

2. **Task Dependencies**
   ```bash
   # Fix dependensi yang rusak
   task-master fix-dependencies
   ```

3. **Sinkronisasi File**
   ```bash
   # Regenerate task files
   task-master generate
   ```

## API Keys

1. **Gemini API Key**
   - Dapatkan dari [Google AI Studio](https://ai.google.dev/)
   - Set di `.env`: `GEMINI_API_KEY=your_key`

2. **Perplexity API Key (Opsional)**
   - Untuk fitur research
   - Set di `.env`: `PERPLEXITY_API_KEY=your_key`

## Lisensi

MIT
