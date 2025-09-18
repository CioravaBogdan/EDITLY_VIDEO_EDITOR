# RESEARCH: MIGRARE EDITLY → SOLUȚII GPU ACCELERATE

## 🎯 PROMPT PENTRU IMPLEMENTAREA SMELTER + RUNPOD

### Context actual:
- Am aplicația Editly pe CPU (Ryzen 5950X, 16 cores) care procesează 32 imagini + audio → MP4
- Timp actual: ~7 min/video, nu poate procesa >5 simultan fără să crape
- Folosesc n8n pentru orchestrare + Cloudflare tunnel (editly.byinfant.com)
- Format actual: JSON cu clips[].duration + imagePath + audioFilePath

### Obiectiv:
Implementează sistem GPU-accelerat care să proceseze 10-15 video-uri simultan cu 3-10x mai rapid decât Editly CPU.

---

## 🚀 SOLUȚIA RECOMANDATĂ: SMELTER + RUNPOD

### De ce Smelter:
- **Open-source Rust-based** cu GPU acceleration (WebGL/WebGPU/Vulkan)
- **REST API** similar cu Editly (JSON declarativ)
- **TypeScript SDK** pentru integrare ușoară
- **Docker ready** pentru deployment
- **React-like API** pentru compositions

### De ce RunPod:
- **Per-second billing** ($0.00031/sec când activ)
- **RTX 4090** la $0.34/hour cu spin-up <60s
- **300+ templates** pre-configurate
- **API excellent** pentru n8n integration
- **No egress fees** + 30 regiuni globale

---

## 📋 TASK-URI DE IMPLEMENTAT

### 1. SMELTER API WRAPPER (Node.js/Express)
```javascript
// endpoints-api-wrapper.js
app.post('/jobs', async (req, res) => {
  // Convertește JSON Editly → Smelter format
  const smelterComposition = convertEditlyToSmelter(req.body);
  
  // Queue job pe RunPod GPU
  const jobId = await queueSmelterJob(smelterComposition);
  
  res.json({ jobId, status: 'queued' });
});

app.get('/jobs/:id', async (req, res) => {
  // Check job status pe RunPod
  const status = await checkRunPodJobStatus(req.params.id);
  res.json(status);
});

app.get('/download/:filename', async (req, res) => {
  // Download de pe S3/storage
});
```

### 2. RUNPOD INTEGRATION
```javascript
// runpod-client.js
const runpod = new RunPod({
  apiKey: process.env.RUNPOD_API_KEY
});

async function createSmelterPod() {
  return await runpod.pods.create({
    name: 'smelter-video-renderer',
    imageName: 'smelter/gpu-renderer:latest', // de creat
    gpuType: 'RTX4090',
    containerDiskInGb: 50,
    env: {
      SMELTER_GPU_ACCELERATION: 'vulkan',
      WEBHOOK_URL: process.env.WEBHOOK_URL
    }
  });
}
```

### 3. DOCKER SMELTER IMAGE
```dockerfile
# Dockerfile pentru Smelter GPU
FROM rust:1.70 as builder
RUN apt-get update && apt-get install -y \
    pkg-config libssl-dev vulkan-tools mesa-vulkan-drivers

# Build Smelter cu GPU support
WORKDIR /app
COPY . .
RUN cargo build --release --features vulkan,webgpu

FROM nvidia/cuda:11.8-runtime-ubuntu22.04
RUN apt-get update && apt-get install -y \
    vulkan-tools mesa-vulkan-drivers \
    ffmpeg

COPY --from=builder /app/target/release/smelter /usr/local/bin/
EXPOSE 3000
CMD ["smelter", "serve", "--gpu", "--port", "3000"]
```

### 4. EDITLY → SMELTER CONVERTER
```javascript
// converter.js
function convertEditlyToSmelter(editlyConfig) {
  const { clips, audioFilePath, width, height, fps } = editlyConfig;
  
  return {
    composition: {
      width,
      height,
      fps,
      duration: calculateTotalDuration(clips),
      tracks: [
        {
          type: 'video',
          clips: clips.map(clip => ({
            type: 'image',
            src: clip.layers[0].path,
            duration: clip.duration,
            effects: ['gpu_scale', 'gpu_fade']
          }))
        },
        {
          type: 'audio',
          clips: [{
            src: audioFilePath,
            duration: 'auto'
          }]
        }
      ]
    },
    output: {
      codec: 'h264_nvenc',
      preset: 'p5',
      cq: 19,
      format: 'mp4'
    }
  };
}
```

### 5. QUEUE MANAGEMENT (Redis)
```javascript
// queue-manager.js
const Queue = require('bull');
const videoQueue = new Queue('video processing');

videoQueue.process('smelter-render', async (job) => {
  const { composition, outputPath } = job.data;
  
  // Spin up RunPod instance
  const pod = await createSmelterPod();
  
  try {
    // Send composition to Smelter
    const result = await axios.post(`${pod.ip}:3000/render`, composition);
    
    // Wait for completion + download result
    await waitForCompletion(result.jobId);
    const videoUrl = await downloadFromPod(pod.id, result.outputPath);
    
    // Send webhook to n8n
    await sendWebhook(job.data.webhookUrl, {
      jobId: job.id,
      status: 'completed',
      outputUrl: videoUrl
    });
    
  } finally {
    // Terminate pod to save costs
    await runpod.pods.terminate(pod.id);
  }
});
```

### 6. N8N WORKFLOW UPDATE
```json
{
  "nodes": [
    {
      "name": "Create Video Job",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "https://editly.byinfant.com/jobs",
        "method": "POST",
        "body": {
          "width": 1080,
          "height": 1920,
          "fps": 30,
          "audioFilePath": "{{$node['Upload Audio'].json.outputPath}}",
          "clips": "{{$node['Prepare Images'].json.clips}}",
          "webhookUrl": "{{$node['Webhook'].json.url}}"
        }
      }
    },
    {
      "name": "Wait for Completion",
      "type": "n8n-nodes-base.webhook",
      "parameters": {
        "path": "video-completed"
      }
    }
  ]
}
```

---

## 🛠️ IMPLEMENTARE STEP-BY-STEP

### Faza 1: Setup de bază (Săptămâna 1)
```bash
# 1. Clone Smelter repository
git clone https://github.com/NamseEnt/smelter
cd smelter

# 2. Build Docker image cu GPU support
docker build -t smelter-gpu:latest -f Dockerfile.gpu .

# 3. Setup RunPod account + API keys
# 4. Create wrapper API (Express + Redis)
# 5. Deploy pe un server de test
```

### Faza 2: Integrare (Săptămâna 2-3)
```bash
# 1. Implementează Editly→Smelter converter
# 2. Setup queue system cu Redis
# 3. Create RunPod automation scripts
# 4. Test cu 1-2 video-uri simple
# 5. Measure performance vs Editly
```

### Faza 3: Production (Săptămâna 4)
```bash
# 1. Deploy production API
# 2. Update n8n workflows
# 3. Setup monitoring (GPU usage, costs, performance)
# 4. Gradual migration cu feature flags
# 5. Performance optimization
```

---

## 📊 REZULTATE AȘTEPTATE

### Performance:
- **3-10x mai rapid** decât Editly CPU
- **Procesare simultană** 10-15 video-uri
- **Sub 2 minute** per video (vs 7 min actual)

### Costuri:
- **$0.34/hour** RTX 4090 RunPod
- **Per-second billing** → plătești doar când renderează
- **~$2-5/lună** pentru volume actual
- **70% reducere** vs server dedicat GPU

### Scalabilitate:
- **Auto-scaling** pe cerere
- **Global regions** pentru latență mică
- **Burst capacity** pentru vârfuri de trafic
- **Zero maintenance** hardware GPU

---

## 🎯 PROMPT FINAL PENTRU VS CODE

Creează un proiect `smelter-video-api` cu:

1. **Express API wrapper** care acceptă format JSON Editly
2. **RunPod integration** pentru GPU on-demand  
3. **Smelter converter** din Editly format
4. **Redis queue** pentru job management
5. **Docker containers** pentru deployment
6. **Webhook system** pentru n8n callbacks
7. **Cost monitoring** și auto-termination
8. **Compatibility layer** pentru migrare graduală

Structura:
```
smelter-video-api/
├── src/
│   ├── api/           # Express endpoints
│   ├── converter/     # Editly→Smelter format
│   ├── runpod/        # RunPod client & automation
│   ├── queue/         # Redis queue management
│   └── webhook/       # n8n notifications
├── docker/
│   ├── smelter-gpu/   # Smelter GPU Docker image
│   └── api/           # API wrapper Dockerfile
├── deploy/
│   ├── docker-compose.yml
│   └── k8s/           # Kubernetes manifests
└── tests/
    ├── performance/   # Benchmarks vs Editly
    └── integration/   # End-to-end tests
```

Implementează **totul functional** cu exemple concrete, deployment scripts și documentație pentru migrare de la Editly la Smelter GPU cu costuri minime și performance maxim!
