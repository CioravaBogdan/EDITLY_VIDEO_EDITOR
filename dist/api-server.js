#!/usr/bin/env node
import express from 'express';
import multer from 'multer';
import * as path from 'path';
import path__default from 'path';
import * as fs from 'fs/promises';
import fs__default from 'fs/promises';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import cors from 'cors';
import { E as Editly } from './index-yZBEadH7.js';
import { Worker } from 'worker_threads';
import 'assert';
import 'fs-extra';
import 'json5';
import 'os';
import 'lodash-es';
import 'p-map';
import 'compare-versions';
import 'execa';
import 'nanoid';
import 'url';
import 'canvas';
import 'fabric/node';
import 'gl';
import 'gl-shader';
import 'node:fs/promises';
import 'file-url';
import 'stream';
import 'lodash-es/flatMap.js';
import 'gl-buffer';
import 'gl-texture2d';
import 'gl-transition';
import 'gl-transitions';
import 'ndarray';
import 'perf_hooks';

class ParallelRenderer {
  maxWorkers = 16;
  // 🚀 16 CORES PARALELI
  activeWorkers = [];
  jobQueue = [];
  completedSegments = [];
  constructor() {
    console.log(`\u{1F680} Parallel Renderer initialized with ${this.maxWorkers} workers`);
  }
  async renderParallel(editSpec) {
    const startTime = Date.now();
    console.log(`\u{1F3AC} Starting PARALLEL rendering with ${this.maxWorkers} cores`);
    const segments = this.splitIntoSegments(editSpec);
    console.log(`\u{1F4F9} Split into ${segments.length} segments for parallel processing`);
    const segmentPaths = await this.processSegmentsParallel(segments, editSpec);
    const finalPath = await this.concatenateSegments(segmentPaths, editSpec.outPath);
    const processingTime = (Date.now() - startTime) / 1e3;
    console.log(`\u2705 PARALLEL rendering completed in ${processingTime}s using ${this.maxWorkers} cores`);
    return finalPath;
  }
  splitIntoSegments(editSpec) {
    const segments = [];
    const totalClips = editSpec.clips.length;
    const clipsPerSegment = Math.max(1, Math.ceil(totalClips / this.maxWorkers));
    for (let i = 0; i < totalClips; i += clipsPerSegment) {
      const segmentClips = editSpec.clips.slice(i, i + clipsPerSegment);
      segments.push({
        segmentIndex: segments.length,
        clips: segmentClips,
        startClipIndex: i,
        endClipIndex: Math.min(i + clipsPerSegment - 1, totalClips - 1)
      });
    }
    console.log(`\u{1F4CA} Split ${totalClips} clips into ${segments.length} segments (${clipsPerSegment} clips each)`);
    return segments;
  }
  async processSegmentsParallel(segments, editSpec) {
    const promises = [];
    console.log(`\u{1F680} Launching ${segments.length} parallel workers...`);
    for (const segment of segments) {
      const segmentEditSpec = {
        ...editSpec,
        clips: segment.clips,
        outPath: `/app/temp/segment_${segment.segmentIndex}.mp4`
      };
      const promise = this.processSegmentWithWorker(segmentEditSpec, segment.segmentIndex);
      promises.push(promise);
    }
    const segmentPaths = await Promise.all(promises);
    console.log(`\u2705 All ${segmentPaths.length} segments completed in parallel!`);
    return segmentPaths;
  }
  async processSegmentWithWorker(segmentEditSpec, segmentIndex) {
    return new Promise((resolve, reject) => {
      const __filename = new URL(import.meta.url).pathname;
      const __dirname = path.dirname(__filename);
      const workerPath = path.join(__dirname, "segment-worker.js");
      const worker = new Worker(workerPath, {
        workerData: { segmentEditSpec, segmentIndex }
      });
      console.log(`\u{1F525} Worker ${segmentIndex} started (PID: ${worker.threadId})`);
      worker.on("message", (result) => {
        if (result.success) {
          console.log(`\u2705 Worker ${segmentIndex} completed: ${result.outputPath}`);
          resolve(result.outputPath);
        } else {
          console.error(`\u274C Worker ${segmentIndex} failed:`, result.error);
          reject(new Error(result.error));
        }
      });
      worker.on("error", (error) => {
        console.error(`\u{1F4A5} Worker ${segmentIndex} crashed:`, error);
        reject(error);
      });
      worker.on("exit", (code) => {
        if (code !== 0) {
          console.error(`\u26A0\uFE0F  Worker ${segmentIndex} exited with code ${code}`);
        }
      });
      this.activeWorkers.push(worker);
    });
  }
  async concatenateSegments(segmentPaths, outputPath) {
    console.log(`\u{1F517} Concatenating ${segmentPaths.length} segments with FFmpeg...`);
    const concatList = segmentPaths.map((path2) => `file '${path2}'`).join("\n");
    const concatFile = "/app/temp/concat_list.txt";
    await fs.writeFile(concatFile, concatList);
    return new Promise((resolve, reject) => {
      const ffmpegArgs = [
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        concatFile,
        "-c",
        "copy",
        // 🚀 Copy fără re-encoding
        "-threads",
        "16",
        // 🚀 16 threads pentru concat
        "-y",
        outputPath
      ];
      console.log(`\u{1F3AC} FFmpeg concat command: ffmpeg ${ffmpegArgs.join(" ")}`);
      const ffmpeg = spawn("/usr/local/ffmpeg/bin/ffmpeg", ffmpegArgs);
      ffmpeg.on("close", (code) => {
        if (code === 0) {
          console.log(`\u2705 Concatenation completed: ${outputPath}`);
          this.cleanup(segmentPaths, concatFile);
          resolve(outputPath);
        } else {
          console.error(`\u274C FFmpeg concat failed with code: ${code}`);
          reject(new Error(`FFmpeg concat failed with code: ${code}`));
        }
      });
      ffmpeg.on("error", (error) => {
        console.error("\u{1F4A5} FFmpeg concat error:", error);
        reject(error);
      });
    });
  }
  async cleanup(segmentPaths, concatFile) {
    console.log(`\u{1F9F9} Cleaning up ${segmentPaths.length} temporary segments...`);
    try {
      for (const segmentPath of segmentPaths) {
        await fs.unlink(segmentPath).catch(() => {
        });
      }
      await fs.unlink(concatFile).catch(() => {
      });
      console.log(`\u2705 Cleanup completed`);
    } catch (error) {
      console.warn("\u26A0\uFE0F  Cleanup warning:", error);
    }
  }
  destroy() {
    this.activeWorkers.forEach((worker) => {
      worker.terminate();
    });
    this.activeWorkers = [];
    console.log(`\u{1F6D1} All workers terminated`);
  }
}

const FFMPEG_THREADS = process.env.FFMPEG_THREADS || "0";
const EXTERNAL_DOMAIN = process.env.EXTERNAL_DOMAIN || "https://editly.byinfant.com";
const USE_GPU = String(process.env.USE_GPU || "").toLowerCase() === "true";
const VIDEO_ENCODER = (process.env.VIDEO_ENCODER || (USE_GPU ? "h264_nvenc" : "libx264")).toLowerCase();
const USE_PARALLEL_PROCESSING = String(process.env.USE_PARALLEL_PROCESSING || "true").toLowerCase() === "true";
function buildEncoderArgs(encoder) {
  if (encoder === "h264_nvenc") {
    return [
      "-c:v",
      "h264_nvenc",
      "-preset",
      process.env.NVENC_PRESET || "fast",
      "-cq",
      process.env.NVENC_CQ || "20",
      "-g",
      process.env.GOP_SIZE || "120",
      "-bf",
      "0",
      "-pix_fmt",
      "yuv420p",
      // Threads mostly ignored by NVENC, but keep for filters/mux
      "-threads",
      FFMPEG_THREADS
    ];
  }
  if (encoder === "hevc_nvenc") {
    return [
      "-c:v",
      "hevc_nvenc",
      "-preset",
      process.env.NVENC_PRESET || "fast",
      "-cq",
      process.env.NVENC_CQ || "20",
      "-g",
      process.env.GOP_SIZE || "120",
      "-bf",
      "0",
      "-pix_fmt",
      "yuv420p",
      "-threads",
      FFMPEG_THREADS
    ];
  }
  return [
    "-c:v",
    "libx264",
    "-preset",
    "slow",
    // Maximum quality
    "-crf",
    "10",
    // Very high quality (10 = near lossless)
    "-profile:v",
    "high",
    // High profile supports yuv444p
    "-level",
    "4.0",
    // Higher level for better quality
    "-g",
    "30",
    // Smaller GOP
    "-bf",
    "0",
    // No B-frames
    "-refs",
    "1",
    // Single reference
    "-threads",
    FFMPEG_THREADS,
    // Use 16 threads
    "-x264opts",
    "threads=16:lookahead_threads=8:sliced_threads=1:frame_threads=4",
    "-tune",
    "zerolatency"
    // Zero latency tuning
  ];
}
const execAsync = promisify(exec);
const app = express();
const PORT = process.env.PORT || 3001;
const parallelRenderer = new ParallelRenderer();
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
const storage = multer.diskStorage({
  destination: (req2, file, cb) => {
    cb(null, "/app/uploads/");
  },
  filename: (req2, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path__default.extname(file.originalname));
  }
});
const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024
    // 500MB limit
  }
});
async function ensureDirectories() {
  try {
    await fs__default.mkdir("/app/uploads", { recursive: true });
    await fs__default.mkdir("/outputs", { recursive: true });
    await fs__default.mkdir("/app/temp", { recursive: true });
  } catch (err) {
    console.error("Error creating directories:", err);
  }
}
app.get("/health", (req2, res2) => {
  res2.json({
    status: "ok",
    service: "editly-api",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    version: "1.0.0"
  });
});
app.get("/info", (req2, res2) => {
  res2.json({
    service: "Editly Video Editor API",
    version: "1.0.0",
    description: "HTTP API wrapper for Editly video editing library",
    runtime: {
      externalDomain: EXTERNAL_DOMAIN,
      useGpu: USE_GPU,
      videoEncoder: VIDEO_ENCODER,
      ffmpegThreads: FFMPEG_THREADS
    },
    endpoints: {
      health: "GET /health",
      info: "GET /info",
      edit: "POST /edit",
      upload: "POST /upload",
      download: "GET /download/:filename",
      files: "GET /files",
      audioInfo: "POST /audio-info"
    },
    documentation: "https://github.com/mifi/editly"
  });
});
app.post("/audio-info", async (req2, res2) => {
  try {
    const { audioPath } = req2.body;
    if (!audioPath) {
      return res2.status(400).json({ error: "audioPath is required" });
    }
    const { readDuration, readFileStreams } = await import('./index-yZBEadH7.js').then(function (n) { return n.f; });
    try {
      const duration = await readDuration(audioPath);
      const streams = await readFileStreams(audioPath);
      const audioStream2 = streams.find((s) => s.codec_type === "audio");
      const audioInfo = {
        duration: Math.round(duration * 100) / 100,
        // Round to 2 decimals
        hasAudio: !!audioStream2,
        codec: audioStream2?.codec_name || "unknown",
        sampleRate: audioStream2?.tags?.sample_rate || "unknown",
        channels: audioStream2?.channels || "unknown",
        bitrate: audioStream2?.tags?.bit_rate || "unknown"
      };
      console.log(`\u{1F3B5} Audio info for ${audioPath}:`, audioInfo);
      res2.json({
        success: true,
        audioPath,
        ...audioInfo
      });
    } catch (fileError) {
      console.error(`\u274C Error reading audio file ${audioPath}:`, fileError);
      res2.status(404).json({
        error: "Could not read audio file",
        audioPath,
        details: fileError.message
      });
    }
  } catch (error) {
    console.error("Audio info error:", error);
    res2.status(500).json({
      error: "Failed to get audio info",
      details: error.message
    });
  }
});
app.post("/upload", upload.array("files"), async (req2, res2) => {
  try {
    if (!req2.files || req2.files.length === 0) {
      return res2.status(400).json({ error: "No files uploaded" });
    }
    const uploadedFiles = req2.files.map((file) => ({
      originalName: file.originalname,
      filename: file.filename,
      path: file.path,
      size: file.size,
      url: `/uploads/${file.filename}`
    }));
    res2.json({
      message: "Files uploaded successfully",
      files: uploadedFiles
    });
  } catch (error) {
    console.error("Upload error:", error);
    res2.status(500).json({ error: "Upload failed", details: error.message });
  }
});
app.post("/edit", async (req2, res2) => {
  try {
    req2.setTimeout(45 * 60 * 1e3);
    res2.setTimeout(45 * 60 * 1e3);
    const { editSpec, outputFilename } = req2.body;
    if (!editSpec) {
      return res2.status(400).json({ error: "editSpec is required" });
    }
    const outputName = outputFilename || `output-${Date.now()}.mp4`;
    const outputPath = `/outputs/${outputName}`;
    const videoEncoderArgs = buildEncoderArgs(VIDEO_ENCODER);
    const finalEditSpec = {
      ...editSpec,
      outPath: outputPath,
      // ✅ Audio volume configuration - RESPECT USER'S AUDIO SETTINGS
      outputVolume: editSpec.outputVolume || 1,
      // 🎯 Volum din spec user sau default
      clipsAudioVolume: editSpec.clipsAudioVolume || 1,
      // 🎯 Volum din spec user sau default
      // 🚀 OPTIMIZĂRI CPU MAXIME pentru 16 cores
      ffmpegOptions: {
        input: [
          "-threads",
          FFMPEG_THREADS,
          // 🚀 FORȚEZ 16 threads pentru input
          "-thread_type",
          "slice+frame",
          "-hwaccel",
          "auto"
          // 🚀 Hardware acceleration dacă disponibil
        ],
        output: [
          "-threads",
          FFMPEG_THREADS,
          // 🚀 FORȚEZ 16 threads pentru output
          "-thread_type",
          "slice+frame"
        ]
      },
      customOutputArgs: [
        ...videoEncoderArgs,
        // 🎬 VIDEO QUALITY SETTINGS
        "-b:v",
        "10M",
        // High video bitrate (10 Mbps)
        "-maxrate",
        "15M",
        // Max bitrate 15 Mbps
        "-bufsize",
        "20M",
        // Buffer size for quality
        "-pix_fmt",
        "yuv420p",
        // Compatible pixel format with baseline profile
        // 🎵 AUDIO
        "-c:a",
        "aac",
        "-b:a",
        process.env.AUDIO_BITRATE || "320k",
        // Maximum audio quality
        "-ac",
        "2",
        "-ar",
        "48000",
        // Higher sample rate
        // Flags utile pentru playback
        "-movflags",
        "+faststart",
        "-fflags",
        "+genpts+igndts",
        "-avoid_negative_ts",
        "make_zero"
      ],
      // 🚀 CONFIGURAȚII PENTRU CALITATE MAXIMĂ  
      fast: false,
      // Dezactivat pentru calitate maximă
      verbose: false,
      allowRemoteRequests: false,
      enableFfmpegLog: false,
      // 🚀 OPTIMĂ PARALELIZARE pentru 16 cores
      concurrency: 1,
      // 🚀 Un singur video la momentul dat
      frameSourceConcurrency: 16,
      // 🚀 16 frame sources paralele  
      frameRenderConcurrency: 16,
      // 🚀 16 frame renders paralele
      enableFfmpegLog: false,
      // 🚀 Disable pentru performance
      canvasRenderingConcurrency: 16,
      // 🚀 16 canvas renders paralele
      tempDir: "/app/temp",
      // 🚀 CONFIGURAȚII ULTRA-PERFORMANȚĂ pentru CPU INTENSIV
      enableClipsAudioVolume: true,
      enableFfmpegStreaming: true,
      enableFfmpegMultipass: false,
      // Dezactivat pentru viteză maximă
      // 🚀 SETĂRI AVANSATE PENTRU MAXIMIZARE CPU - RESPECT USER'S AUDIO
      keepSourceAudio: editSpec.keepSourceAudio !== void 0 ? editSpec.keepSourceAudio : true,
      // 🎯 PĂSTREAZĂ din spec sau default TRUE
      keepTempFiles: false,
      // 🚀 Șterge temp files pentru economie spațiu
      outDir: "/outputs",
      // 🚀 Output directory explicit
      // 🚀 OPTIMIZĂRI SPECIFICE PENTRU 16 CORES
      logLevel: "error",
      // 🚀 Reduce logging overhead
      enableProgressBar: false
      // 🚀 Disable progress bar pentru performance
    };
    console.log("Starting video edit with", USE_PARALLEL_PROCESSING ? "PARALLEL 16-CORE" : "STANDARD", "processing:", JSON.stringify(finalEditSpec, null, 2));
    if (USE_PARALLEL_PROCESSING && finalEditSpec.clips && finalEditSpec.clips.length > 1) {
      console.log(`\u{1F680} Using ParallelRenderer for ${finalEditSpec.clips.length} clips across 16 cores`);
      await parallelRenderer.renderParallel(finalEditSpec);
    } else {
      console.log("\u{1F504} Using standard Editly (single-core)");
      await Editly(finalEditSpec);
    }
    try {
      await fs__default.access(outputPath);
      res2.json({
        message: "Video editing completed successfully",
        outputPath,
        outputFilename: outputName,
        downloadUrl: `${EXTERNAL_DOMAIN}/download/${outputName}`
      });
    } catch (err) {
      throw new Error("Output file was not created");
    }
  } catch (error) {
    console.error("Edit error:", error);
    res2.status(500).json({
      error: "Video editing failed",
      details: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : void 0
    });
  }
});
app.get("/download/:filename", async (req2, res2) => {
  try {
    const filename2 = req2.params.filename;
    const filePath2 = `/outputs/${filename2}`;
    await fs__default.access(filePath2);
    res2.setHeader("Content-Disposition", `attachment; filename="${filename2}"`);
    res2.setHeader("Content-Type", "video/mp4");
    res2.sendFile(filePath2);
  } catch (error) {
    console.error("Download error:", error);
    res2.status(404).json({ error: "File not found" });
  }
});
app.get("/files", async (req2, res2) => {
  try {
    const files = await fs__default.readdir("/outputs");
    const fileList = await Promise.all(
      files.map(async (filename2) => {
        const filePath2 = `/outputs/${filename2}`;
        const stats2 = await fs__default.stat(filePath2);
        return {
          filename: filename2,
          size: stats2.size,
          created: stats2.birthtime,
          modified: stats2.mtime,
          downloadUrl: `${EXTERNAL_DOMAIN}/download/${filename2}`
        };
      })
    );
    res2.json({
      files: fileList,
      count: fileList.length
    });
  } catch (error) {
    console.error("Files list error:", error);
    res2.status(500).json({ error: "Failed to list files" });
  }
});
app.get("/metadata/:filename", async (req, res) => {
  try {
    const filename = req.params.filename;
    let filePath = `/outputs/${filename}`;
    let fileLocation = "outputs";
    try {
      await fs__default.access(filePath);
    } catch {
      filePath = `/app/uploads/${filename}`;
      fileLocation = "uploads";
      try {
        await fs__default.access(filePath);
      } catch {
        return res.status(404).json({
          error: "File not found",
          message: `File '${filename}' not found in outputs or uploads directories`
        });
      }
    }
    const stats = await fs__default.stat(filePath);
    const ffprobeCommand = `ffprobe -v quiet -print_format json -show_format -show_streams "${filePath}"`;
    try {
      const { stdout } = await execAsync(ffprobeCommand);
      const metadata = JSON.parse(stdout);
      const videoStream = metadata.streams?.find((s) => s.codec_type === "video");
      const audioStream = metadata.streams?.find((s) => s.codec_type === "audio");
      const result = {
        filename,
        fileLocation,
        // outputs sau uploads
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        duration: parseFloat(metadata.format?.duration || "0"),
        bitrate: parseInt(metadata.format?.bit_rate || "0"),
        format: metadata.format?.format_name,
        video: videoStream ? {
          codec: videoStream.codec_name,
          width: videoStream.width,
          height: videoStream.height,
          fps: eval(videoStream.r_frame_rate || "0"),
          bitrate: parseInt(videoStream.bit_rate || "0")
        } : null,
        audio: audioStream ? {
          codec: audioStream.codec_name,
          channels: audioStream.channels,
          sample_rate: parseInt(audioStream.sample_rate || "0"),
          bitrate: parseInt(audioStream.bit_rate || "0")
        } : null,
        downloadUrl: fileLocation === "outputs" ? `${EXTERNAL_DOMAIN}/download/${filename}` : `${EXTERNAL_DOMAIN}/uploads/${filename}`
      };
      res.json(result);
    } catch (ffprobeError) {
      console.warn("FFprobe failed, returning basic file info:", ffprobeError);
      res.json({
        filename,
        fileLocation,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        downloadUrl: fileLocation === "outputs" ? `${EXTERNAL_DOMAIN}/download/${filename}` : `${EXTERNAL_DOMAIN}/uploads/${filename}`,
        error: "Could not extract media metadata"
      });
    }
  } catch (error) {
    console.error("Metadata error:", error);
    res.status(500).json({ error: "Failed to get file metadata" });
  }
});
app.use("/uploads", express.static("/app/uploads"));
app.use((error, req2, res2, next) => {
  console.error("Unhandled error:", error);
  res2.status(500).json({
    error: "Internal server error",
    details: error.message
  });
});
app.use((req2, res2) => {
  res2.status(404).json({ error: "Endpoint not found" });
});
async function startServer() {
  await ensureDirectories();
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`\u{1F680} Editly API Server running on http://0.0.0.0:${PORT}`);
    console.log(`\u{1F4D6} API Documentation: http://0.0.0.0:${PORT}/info`);
    console.log(`\u2764\uFE0F  Health Check: http://0.0.0.0:${PORT}/health`);
  });
  server.timeout = 45 * 60 * 1e3;
  server.keepAliveTimeout = 45 * 60 * 1e3;
  server.headersTimeout = 45 * 60 * 1e3 + 1e3;
}
process.on("SIGTERM", () => {
  console.log("Received SIGTERM, shutting down gracefully");
  process.exit(0);
});
process.on("SIGINT", () => {
  console.log("Received SIGINT, shutting down gracefully");
  process.exit(0);
});
startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
//# sourceMappingURL=api-server.js.map
