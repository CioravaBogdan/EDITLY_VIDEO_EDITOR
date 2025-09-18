# MIGRARE EDITLY → SISTEM RENDER CU QUEUE & FFmpeg NVENC

## 1. SUMAR FUNCȚIONALITATE ACTUALĂ EDITLY

### API Editly (ce folosești acum)
- POST /edit — procesează video (JSON cu imagini, audio, durate)
- GET /download/:file — descarcă video
- POST /cleanup — cleanup manual
- GET /disk-usage — info storage
- GET /health — health check

### Config Editly (exemplu):
```json
{
  "width": 1080,
  "height": 1920,
  "fps": 30,
  "audioFilePath": "/uploads/naratie.mp3",
  "clips": [
    { "duration": 5, "layers": [{ "type": "image", "path": "/uploads/page1.jpg" }] }
    // ...
  ],
  "customOutputArgs": ["-c:v","libx264","-preset","ultrafast","-crf","28","-b:a","128k"]
}
```

### Docker Compose actual:
```yaml
services:
  editly-api:
    ports: ["3001:3001"]
    environment:
      - EXTERNAL_DOMAIN=https://editly.byinfant.com
      - AUTO_CLEANUP_ENABLED=true
      - CLEANUP_AFTER_HOURS=2
      - FFMPEG_THREADS=16
    volumes:
      - ./uploads:/app/uploads
      - ./outputs:/outputs
      - ./temp:/tmp
```

---

## 2. ARHITECTURĂ NOUĂ SUGERATĂ (FFmpeg+Queue)

- Render API (Node.js/Express) — primește joburi, răspunde cu job_id
- Redis Queue — gestionează joburi
- Worker pool (CPU+GPU) — procesează joburi cu FFmpeg
- Webhook către n8n la final
- Storage local (sau S3 mai târziu)
- Cleanup automat după 2h

### Structură proiect:
```
video-render-queue/
├── render-api/
│   ├── src/
│   │   ├── server.js         # Express API
│   │   ├── queue.js          # Redis queue logic
│   │   └── webhook.js        # n8n notifications
│   ├── Dockerfile
│   └── package.json
├── worker/
│   ├── src/
│   │   ├── worker.js         # Queue consumer
│   │   ├── ffmpeg.js         # FFmpeg commands
│   │   └── cleanup.js        # Auto cleanup
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
└── .env
```

### API Endpoints:
- POST /jobs — creare job nou (format JSON ca la Editly)
- GET /jobs/:id — status job
- GET /download/:filename — download video
- POST /cleanup — cleanup manual
- GET /health — health check

### Format input JSON (compatibil cu Editly):
```json
{
  "width": 1080,
  "height": 1920,
  "fps": 30,
  "audioFilePath": "/uploads/audio.mp3",
  "outputFilename": "carte_digitala_2025.mp4",
  "clips": [
    { "duration": 5, "imagePath": "/uploads/page1.jpg" }
  ]
}
```

### FFmpeg command:
```bash
# CPU
ffmpeg -f concat -safe 0 -i list.txt -i audio.mp3 \
  -c:v libx264 -preset medium -crf 23 \
  -c:a aac -b:a 128k -shortest output.mp4
# GPU
ffmpeg -f concat -safe 0 -i list.txt -i audio.mp3 \
  -c:v h264_nvenc -preset p5 -cq 23 \
  -c:a aac -b:a 128k -shortest output.mp4
```

### Docker Compose de pornire:
```yaml
services:
  redis:
    image: redis:7
  render-api:
    build: ./render-api
    ports: ["3001:3001"]
    environment:
      - REDIS_URL=redis://redis:6379
      - WEBHOOK_URL=${WEBHOOK_URL}
      - EXTERNAL_DOMAIN=https://editly.byinfant.com
    volumes:
      - ./uploads:/uploads
      - ./outputs:/outputs
  worker-cpu:
    build: ./worker
    deploy:
      replicas: 4
    environment:
      - REDIS_URL=redis://redis:6379
      - USE_GPU=false
    volumes:
      - ./uploads:/uploads
      - ./outputs:/outputs
```

### Funcționalități critice de păstrat:
- Sincronizare audio/video
- Cleanup automat după 2h
- URL-uri externe (Cloudflare tunnel)
- Compatibilitate n8n (același JSON)
- Protecție fișiere în procesare

### Prompt pentru VS Code (copy/paste):

> Creează un proiect nou cu structura de mai sus, cu Render API (Express+Redis), worker (queue+FFmpeg), cleanup automat, compatibil cu JSON-ul Editly, Docker Compose complet, webhook la n8n, și suport atât CPU cât și GPU (NVENC). Vreau să pot rula `docker-compose up` și să procesez video-uri ca până acum, dar mult mai rapid și scalabil.

---

**Acest fișier conține tot ce ai nevoie pentru migrare și setup rapid!**
