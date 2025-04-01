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

## Daftar Perintah Lengkap

### Inisialisasi Proyek

```bash
# Inisialisasi proyek baru dengan struktur Task Master
task-master init

# Inisialisasi dengan nilai-nilai yang sudah ditentukan
task-master init -n "Nama Proyek" -d "Deskripsi Proyek" -v "1.0.0"

# Inisialisasi dengan opsi non-interaktif
task-master init -y
```

### Mengelola Tugas

```bash
# Parsing PRD untuk menghasilkan tugas-tugas
task-master parse-prd --input=requirements.txt
task-master parse-prd --input=requirements.txt --num-tasks=15
task-master parse-prd --input=requirements.txt --output=custom-tasks.json

# Melihat daftar tugas
task-master list
task-master list --status=pending
task-master list --with-subtasks

# Melihat tugas yang harus dikerjakan selanjutnya
task-master next

# Melihat detail tugas tertentu
task-master show 1
task-master show --id=1
task-master show 1.2  # Untuk melihat subtask

# Mengubah status tugas
task-master set-status --id=1 --status=done
task-master set-status --id=1,2,3 --status=done  # Multiple tasks
task-master set-status --id=1.1,1.2 --status=done  # Subtasks
```

### Menghasilkan File Tugas

```bash
# Menghasilkan file tugas dari tasks.json
task-master generate
task-master generate --file=custom-tasks.json
task-master generate --output=custom-directory
```

### Pemecahan Tugas dan Analisis Kompleksitas

```bash
# Menganalisis kompleksitas tugas
task-master analyze-complexity
task-master analyze-complexity --research  # Dengan Perplexity AI
task-master analyze-complexity --threshold=6  # Custom threshold (1-10)

# Melihat laporan kompleksitas
task-master complexity-report

# Memecah tugas menjadi subtasks
task-master expand --id=5 --num=3
task-master expand --id=5 --research  # Dengan Perplexity AI
task-master expand --id=5 --prompt="Fokus pada aspek keamanan"
task-master expand --all  # Perluas semua tugas

# Menghapus subtasks
task-master clear-subtasks --id=5
task-master clear-subtasks --id=1,2,3
task-master clear-subtasks --all
```

### Mengelola Dependensi

```bash
# Menambahkan dependensi
task-master add-dependency --id=5 --depends-on=4

# Menghapus dependensi
task-master remove-dependency --id=5 --depends-on=4

# Validasi dependensi tanpa memperbaiki
task-master validate-dependencies

# Memperbaiki dependensi secara otomatis
task-master fix-dependencies
```

### Mengelola Subtasks

```bash
# Menambahkan subtask baru
task-master add-subtask --parent=5 --title="Implementasi Login UI" --description="Buat form login"

# Mengkonversi tugas menjadi subtask
task-master add-subtask --parent=5 --task-id=8

# Menghapus subtask
task-master remove-subtask --id=5.2

# Mengubah subtask menjadi task independen
task-master remove-subtask --id=5.2 --convert
```

### Memperbarui dan Menambahkan Tugas

```bash
# Memperbarui tugas berdasarkan perubahan implementasi
task-master update --from=5 --prompt="Sekarang kita menggunakan ExpressJS bukan Fastify"

# Menambahkan tugas baru dengan AI
task-master add-task --prompt="Implementasi fitur otentikasi dengan OAuth"
task-master add-task --prompt="Implementasi dark mode" --dependencies=10,11 --priority=high
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
   
3. **Analisis Kompleksitas**
   ```bash
   # Dengan research
   task-master analyze-complexity --research
   
   # Lihat hasil analisis
   task-master complexity-report
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

1. **Gemini API Rate Limits**
   - Tunggu beberapa saat dan coba lagi
   - Pastikan API key Anda memiliki kuota yang cukup

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
