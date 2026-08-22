import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import { spawn } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";

const DATA_DIR = path.join(__dirname, "data");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
const OUTPUTS_DIR = path.join(DATA_DIR, "outputs");

for (const dir of [DATA_DIR, UPLOADS_DIR, OUTPUTS_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

app.use(express.json());

/*
 * IMPORTANT:
 * index.html, style.css and app.js are in the ROOT
 * of the repository, not inside /public.
 */
app.use(express.static(__dirname));

/*
 * MAIN WEBSITE
 */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

/*
 * Upload configuration
 */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },

  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    cb(null, `${randomUUID()}${ext}`);
  }
});

const upload = multer({
  storage,

  limits: {
    fileSize: 100 * 1024 * 1024
  },

  fileFilter: (req, file, cb) => {
    const allowed = [
      "video/mp4",
      "video/webm",
      "video/quicktime",
      "video/x-matroska"
    ];

    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only MP4, WebM, MOV or MKV videos are allowed."));
    }
  }
});

/*
 * Jobs
 */
const jobs = new Map();

/*
 * Run FFmpeg
 */
function runFFmpeg(input, output) {
  return new Promise((resolve, reject) => {
    const args = [
      "-y",
      "-i",
      input,

      // Remove metadata and chapters
      "-map_metadata",
      "-1",
      "-map_chapters",
      "-1",

      // Video
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "23",
      "-pix_fmt",
      "yuv420p",

      // Audio
      "-c:a",
      "aac",
      "-b:a",
      "160k",

      // Web optimized MP4
      "-movflags",
      "+faststart",

      output
    ];

    const ffmpeg = spawn("ffmpeg", args);

    let stderr = "";

    ffmpeg.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    ffmpeg.on("error", (error) => {
      reject(
        new Error(
          `FFmpeg could not start. ${error.message}`
        )
      );
    });

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            `FFmpeg failed with exit code ${code}.`
          )
        );
      }
    });
  });
}

/*
 * PROCESS VIDEO
 */
app.post("/api/process", upload.single("video"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: "Please upload a video file."
      });
    }

    const id = randomUUID();

    const input = req.file.path;
    const output = path.join(
      OUTPUTS_DIR,
      `${id}.mp4`
    );

    jobs.set(id, {
      id,
      status: "processing",
      progress: 5,
      input,
      output,
      originalName: req.file.originalname,
      createdAt: Date.now(),
      error: null
    });

    res.json({
      id,
      status: "processing",
      progress: 5
    });

    /*
     * Process in background
     */
    try {
      jobs.get(id).progress = 20;

      await runFFmpeg(input, output);

      if (!fs.existsSync(output)) {
        throw new Error("Output video was not created.");
      }

      jobs.get(id).progress = 100;
      jobs.get(id).status = "complete";
    } catch (error) {
      const job = jobs.get(id);

      if (job) {
        job.status = "error";
        job.progress = 0;
        job.error = error.message;
      }
    } finally {
      /*
       * Delete uploaded temporary file
       */
      try {
        if (fs.existsSync(input)) {
          fs.unlinkSync(input);
        }
      } catch {}
    }
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: error.message || "Processing failed."
    });
  }
});

/*
 * JOB STATUS
 */
app.get("/api/status/:id", (req, res) => {
  const job = jobs.get(req.params.id);

  if (!job) {
    return res.status(404).json({
      error: "Job not found."
    });
  }

  const response = {
    id: job.id,
    status: job.status,
    progress: job.progress
  };

  if (job.status === "complete") {
    response.download = `/api/download/${job.id}`;
  }

  if (job.status === "error") {
    response.error = job.error || "Processing failed.";
  }

  res.json(response);
});

/*
 * DOWNLOAD OUTPUT
 */
app.get("/api/download/:id", (req, res) => {
  const job = jobs.get(req.params.id);

  if (!job) {
    return res.status(404).json({
      error: "File not found."
    });
  }

  if (job.status !== "complete") {
    return res.status(409).json({
      error: "Video is not ready yet."
    });
  }

  if (!fs.existsSync(job.output)) {
    return res.status(404).json({
      error: "Output file is no longer available."
    });
  }

  res.download(
    job.output,
    "cr-clean-ai-optimized.mp4"
  );
});

/*
 * Multer / upload errors
 */
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        error: "Maximum file size is 100 MB."
      });
    }

    return res.status(400).json({
      error: err.message
    });
  }

  if (err) {
    return res.status(400).json({
      error: err.message || "Request failed."
    });
  }

  next();
});

/*
 * Cleanup old jobs/files
 */
setInterval(() => {
  const now = Date.now();

  for (const [id, job] of jobs.entries()) {
    if (now - job.createdAt > 60 * 60 * 1000) {
      try {
        if (job.input && fs.existsSync(job.input)) {
          fs.unlinkSync(job.input);
        }
      } catch {}

      try {
        if (job.output && fs.existsSync(job.output)) {
          fs.unlinkSync(job.output);
        }
      } catch {}

      jobs.delete(id);
    }
  }
}, 10 * 60 * 1000);

/*
 * START SERVER
 */
app.listen(PORT, HOST, () => {
  console.log(
    `CR Clean AI running on http://${HOST}:${PORT}`
  );
});
