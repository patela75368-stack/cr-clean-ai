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

const PORT = Number(process.env.PORT) || 3000;
const HOST = "0.0.0.0";

const MAX_FILE_SIZE = 100 * 1024 * 1024;
const JOB_TTL = 30 * 60 * 1000;
const MAX_ACTIVE_JOBS = 2;

const DATA_DIR = path.join(__dirname, "data");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
const OUTPUTS_DIR = path.join(DATA_DIR, "outputs");

for (const dir of [
  DATA_DIR,
  UPLOADS_DIR,
  OUTPUTS_DIR
]) {
  fs.mkdirSync(dir, {
    recursive: true
  });
}

app.disable("x-powered-by");

app.use(express.json({
  limit: "1mb"
}));

app.use(express.static(__dirname));

/*
 * HOME
 */
app.get("/", (req, res) => {
  res.sendFile(
    path.join(__dirname, "index.html")
  );
});

/*
 * HEALTH CHECK
 */
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "CR Clean AI",
    timestamp: new Date().toISOString()
  });
});

/*
 * Allowed video types
 */
const ALLOWED_TYPES = new Map([
  ["video/mp4", [".mp4"]],
  ["video/webm", [".webm"]],
  ["video/quicktime", [".mov"]],
  ["video/x-matroska", [".mkv"]]
]);

/*
 * Upload storage
 */
const storage = multer.diskStorage({

  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },

  filename: (req, file, cb) => {

    const ext =
      path.extname(
        file.originalname || ""
      ).toLowerCase();

    cb(
      null,
      `${randomUUID()}${ext}`
    );
  }

});


const upload = multer({

  storage,

  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1
  },

  fileFilter: (req, file, cb) => {

    const mime =
      String(file.mimetype || "")
        .toLowerCase();

    const ext =
      path.extname(
        file.originalname || ""
      ).toLowerCase();

    const allowedExtensions =
      ALLOWED_TYPES.get(mime);

    if (
      allowedExtensions &&
      allowedExtensions.includes(ext)
    ) {
      return cb(null, true);
    }

    cb(
      new Error(
        "Only MP4, WebM, MOV or MKV videos are allowed."
      )
    );
  }

});


/*
 * Jobs
 */
const jobs = new Map();


function getActiveJobCount() {

  let count = 0;

  for (const job of jobs.values()) {

    if (
      job.status === "processing"
    ) {
      count++;
    }
  }

  return count;
}


/*
 * Run FFmpeg safely without shell
 */
function runFFmpeg(input, output) {

  return new Promise(
    (resolve, reject) => {

      const args = [

        "-hide_banner",
        "-loglevel",
        "error",

        "-y",

        "-i",
        input,

        /*
         * Remove metadata
         */
        "-map_metadata",
        "-1",

        "-map_chapters",
        "-1",

        /*
         * Video
         */
        "-c:v",
        "libx264",

        "-preset",
        "veryfast",

        "-crf",
        "23",

        "-pix_fmt",
        "yuv420p",

        /*
         * Audio
         */
        "-c:a",
        "aac",

        "-b:a",
        "160k",

        /*
         * Web optimized MP4
         */
        "-movflags",
        "+faststart",

        output
      ];


      const ffmpeg =
        spawn(
          "ffmpeg",
          args,
          {
            stdio: [
              "ignore",
              "ignore",
              "pipe"
            ]
          }
        );


      let stderr = "";


      ffmpeg.stderr.on(
        "data",
        (data) => {

          stderr +=
            data.toString();

          /*
           * Prevent unlimited
           * memory growth.
           */
          if (
            stderr.length > 12000
          ) {
            stderr =
              stderr.slice(-12000);
          }

        }
      );


      ffmpeg.on(
        "error",
        (error) => {

          reject(
            new Error(
              `FFmpeg could not start. ${error.message}`
            )
          );

        }
      );


      ffmpeg.on(
        "close",
        (code) => {

          if (code === 0) {
            resolve();
            return;
          }


          reject(
            new Error(
              `FFmpeg failed with exit code ${code}.`
            )
          );

        }
      );

    }
  );
}


/*
 * PROCESS VIDEO
 */
app.post(
  "/api/process",
  upload.single("video"),
  async (req, res) => {

    let input = null;

    try {

      if (!req.file) {

        return res.status(400).json({
          error:
            "Please upload a video file."
        });

      }


      input = req.file.path;


      /*
       * Protect server resources
       */
      if (
        getActiveJobCount() >=
        MAX_ACTIVE_JOBS
      ) {

        try {
          fs.unlinkSync(input);
        } catch {}

        return res.status(429).json({
          error:
            "The server is busy. Please try again in a moment."
        });

      }


      const id =
        randomUUID();


      const output =
        path.join(
          OUTPUTS_DIR,
          `${id}.mp4`
        );


      const job = {

        id,

        status: "processing",

        progress: 5,

        input,

        output,

        originalName:
          path.basename(
            req.file.originalname ||
            "video"
          ),

        size:
          req.file.size,

        createdAt:
          Date.now(),

        error: null

      };


      jobs.set(
        id,
        job
      );


      /*
       * Respond immediately.
       */
      res.status(202).json({

        id,

        status:
          "processing",

        progress: 5

      });


      /*
       * Background processing
       */
      try {

        job.progress = 20;


        await runFFmpeg(
          input,
          output
        );


        if (
          !fs.existsSync(output)
        ) {

          throw new Error(
            "Output video was not created."
          );

        }


        job.progress = 100;

        job.status =
          "complete";

      } catch (error) {

        console.error(
          `Job ${id} failed:`,
          error
        );


        job.status =
          "error";

        job.progress = 0;

        job.error =
          "Video processing failed. Please try another video.";

      } finally {

        /*
         * Uploaded source is
         * deleted immediately.
         */
        try {

          if (
            input &&
            fs.existsSync(input)
          ) {

            fs.unlinkSync(input);

          }

        } catch (cleanupError) {

          console.error(
            "Upload cleanup failed:",
            cleanupError
          );

        }

      }

    } catch (error) {

      console.error(
        "Process request failed:",
        error
      );


      if (input) {

        try {

          if (
            fs.existsSync(input)
          ) {
            fs.unlinkSync(input);
          }

        } catch {}

      }


      return res.status(500).json({
        error:
          error.message ||
          "Processing failed."
      });

    }

  }
);


/*
 * JOB STATUS
 */
app.get(
  "/api/status/:id",
  (req, res) => {

    const job =
      jobs.get(
        req.params.id
      );


    if (!job) {

      return res.status(404).json({
        error:
          "Job not found or expired."
      });

    }


    const response = {

      id:
        job.id,

      status:
        job.status,

      progress:
        job.progress

    };


    if (
      job.status ===
      "complete"
    ) {

      response.download =
        `/api/download/${job.id}`;

    }


    if (
      job.status ===
      "error"
    ) {

      response.error =
        job.error ||
        "Processing failed.";

    }


    res.json(
      response
    );

  }
);


/*
 * DOWNLOAD
 */
app.get(
  "/api/download/:id",
  (req, res) => {

    const job =
      jobs.get(
        req.params.id
      );


    if (!job) {

      return res.status(404).json({
        error:
          "File not found or expired."
      });

    }


    if (
      job.status !==
      "complete"
    ) {

      return res.status(409).json({
        error:
          "Video is not ready yet."
      });

    }


    /*
     * Extra path safety check
     */
    const resolvedOutput =
      path.resolve(
        job.output
      );

    const resolvedDirectory =
      path.resolve(
        OUTPUTS_DIR
      );


    if (
      !resolvedOutput.startsWith(
        resolvedDirectory +
        path.sep
      )
    ) {

      return res.status(403).json({
        error:
          "Invalid output path."
      });

    }


    if (
      !fs.existsSync(
        resolvedOutput
      )
    ) {

      return res.status(404).json({
        error:
          "Output file is no longer available."
      });

    }


    res.download(
      resolvedOutput,
      "cr-clean-ai-optimized.mp4",
      (error) => {

        if (error) {

          console.error(
            "Download error:",
            error
          );

        }

      }
    );

  }
);


/*
 * Multer / upload errors
 */
app.use(
  (err, req, res, next) => {

    if (
      err instanceof
      multer.MulterError
    ) {

      if (
        err.code ===
        "LIMIT_FILE_SIZE"
      ) {

        return res.status(400).json({
          error:
            "Maximum file size is 100 MB."
        });

      }


      if (
        err.code ===
        "LIMIT_FILE_COUNT"
      ) {

        return res.status(400).json({
          error:
            "Only one video can be uploaded at a time."
        });

      }


      return res.status(400).json({
        error:
          err.message
      });

    }


    if (err) {

      return res.status(400).json({
        error:
          err.message ||
          "Request failed."
      });

    }


    next();

  }
);


/*
 * Automatic cleanup
 *
 * Completed output files and
 * old job records are removed
 * after 30 minutes.
 */
setInterval(
  () => {

    const now =
      Date.now();


    for (
      const [id, job]
      of jobs.entries()
    ) {

      if (
        now -
        job.createdAt >
        JOB_TTL
      ) {

        try {

          if (
            job.input &&
            fs.existsSync(
              job.input
            )
          ) {

            fs.unlinkSync(
              job.input
            );

          }

        } catch {}


        try {

          if (
            job.output &&
            fs.existsSync(
              job.output
            )
          ) {

            fs.unlinkSync(
              job.output
            );

          }

        } catch {}


        jobs.delete(
          id
        );

      }

    }

  },
  10 * 60 * 1000
);


/*
 * Start server
 */
app.listen(
  PORT,
  HOST,
  () => {

    console.log(
      `CR Clean AI running on http://${HOST}:${PORT}`
    );

  }
);
