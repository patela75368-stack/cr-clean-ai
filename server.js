import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const DATA = path.join(__dirname, "tmp");
const UPLOADS = path.join(DATA, "uploads");
const OUTPUTS = path.join(DATA, "outputs");

for (const d of [UPLOADS, OUTPUTS]) fs.mkdirSync(d, { recursive: true });

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const upload = multer({
  dest: UPLOADS,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["video/mp4", "video/webm", "video/quicktime", "video/x-matroska"];
    cb(null, allowed.includes(file.mimetype));
  }
});

const jobs = new Map();

function runFFmpeg(input, output, jobId) {
  return new Promise((resolve, reject) => {
    // Re-encoding/metadata cleanup is not copyright removal.
    const args = [
      "-y", "-i", input,
      "-map_metadata", "-1",
      "-map_chapters", "-1",
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "22",
      "-c:a", "aac",
      "-b:a", "160k",
      "-movflags", "+faststart",
      output
    ];

    const p = spawn("ffmpeg", args);
    let stderr = "";
    p.stderr.on("data", d => {
      stderr += d.toString();
      const m = stderr.match(/time=(\d+):(\d+):([\d.]+)/);
      if (m) jobs.get(jobId).progress = Math.min(95, jobs.get(jobId).progress + 1);
    });
    p.on("error", reject);
    p.on("close", code => code === 0 ? resolve() : reject(new Error("FFmpeg failed")));
  });
}

app.post("/api/process", upload.single("video"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Please upload a supported video." });

  const id = crypto.randomUUID();
  const input = req.file.path;
  const output = path.join(OUTPUTS, `${id}.mp4`);
  jobs.set(id, { status: "processing", progress: 5, output });

  res.json({ id });

  try {
    jobs.get(id).progress = 15;
    await runFFmpeg(input, output, id);
    jobs.get(id).progress = 100;
    jobs.get(id).status = "complete";
    fs.rmSync(input, { force: true });
  } catch (e) {
    jobs.set(id, { status: "error", progress: 0, error: e.message });
    fs.rmSync(input, { force: true });
    fs.rmSync(output, { force: true });
  }
});

app.get("/api/status/:id", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: "Job not found" });
  res.json({
    status: job.status,
    progress: job.progress,
    download: job.status === "complete" ? `/api/download/${req.params.id}` : null,
    error: job.error || null
  });
});

app.get("/api/download/:id", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job || job.status !== "complete" || !fs.existsSync(job.output))
    return res.status(404).send("File unavailable");
  res.download(job.output, "cr-clean-ai-optimized.mp4");
});

setInterval(() => {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (job.output && fs.existsSync(job.output)) {
      const age = now - fs.statSync(job.output).mtimeMs;
      if (age > 30 * 60 * 1000) fs.rmSync(job.output, { force: true });
    }
    if (job.status !== "processing" && now > (job.createdAt || now) + 60 * 60 * 1000) jobs.delete(id);
  }
}, 10 * 60 * 1000);

app.listen(PORT, () => console.log(`CR Clean AI running on http://localhost:${PORT}`));
