const file = document.getElementById("file");
const choose = document.getElementById("choose");
const drop = document.getElementById("drop");

const work = document.getElementById("work");
const nameEl = document.getElementById("name");
const pct = document.getElementById("pct");
const fill = document.getElementById("fill");
const status = document.getElementById("status");
const dl = document.getElementById("download");

choose.onclick = () => file.click();

drop.onclick = (e) => {
  if (e.target.tagName !== "BUTTON") {
    file.click();
  }
};

file.onchange = () => {
  processVideo(file.files[0]);
};

drop.ondragover = (e) => {
  e.preventDefault();
  drop.style.opacity = ".75";
};

drop.ondragleave = () => {
  drop.style.opacity = "1";
};

drop.ondrop = (e) => {
  e.preventDefault();
  drop.style.opacity = "1";

  const selectedFile = e.dataTransfer.files[0];

  if (selectedFile) {
    processVideo(selectedFile);
  }
};

function setProgress(value) {
  const p = Math.max(0, Math.min(100, Math.round(value)));

  pct.textContent = `${p}%`;
  fill.style.width = `${p}%`;
}

function processVideo(f) {
  if (!f) return;

  if (f.size > 100 * 1024 * 1024) {
    alert("Maximum file size is 100 MB.");
    return;
  }

  nameEl.textContent = f.name;
  work.classList.remove("hidden");
  dl.classList.add("hidden");

  setProgress(0);
  status.textContent = "Uploading your video…";

  const xhr = new XMLHttpRequest();

  xhr.open("POST", "/api/process", true);

  /*
   * Real upload progress
   */
  xhr.upload.onprogress = (event) => {
    if (event.lengthComputable) {
      const uploadPercent =
        (event.loaded / event.total) * 40;

      setProgress(uploadPercent);

      status.textContent =
        `Uploading your video… ${Math.round(uploadPercent)}%`;
    }
  };

  /*
   * Upload finished
   */
  xhr.onload = () => {
    if (xhr.status < 200 || xhr.status >= 300) {
      let message = "Upload failed.";

      try {
        const data = JSON.parse(xhr.responseText);
        message = data.error || message;
      } catch {}

      setProgress(0);
      status.textContent = message;
      return;
    }

    let data;

    try {
      data = JSON.parse(xhr.responseText);
    } catch {
      setProgress(0);
      status.textContent =
        "Server returned an invalid response.";
      return;
    }

    if (!data.id) {
      setProgress(0);
      status.textContent =
        "Server did not return a processing ID.";
      return;
    }

    setProgress(40);
    status.textContent =
      "Upload complete. Processing your video…";

    poll(data.id);
  };

  /*
   * Network error
   */
  xhr.onerror = () => {
    setProgress(0);
    status.textContent =
      "Network error. Please check your connection and try again.";
  };

  /*
   * Timeout
   */
  xhr.timeout = 10 * 60 * 1000;

  xhr.ontimeout = () => {
    setProgress(0);
    status.textContent =
      "Upload timed out. Please try a smaller video.";
  };

  const fd = new FormData();
  fd.append("video", f);

  xhr.send(fd);
}

async function poll(id) {
  try {
    const response =
      await fetch(`/api/status/${id}`);

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || "Unable to check processing status."
      );
    }

    /*
     * Server progress is 5–100.
     * Convert it into the final 40–100% range.
     */
    const serverProgress =
      Number(data.progress) || 0;

    const displayProgress =
      40 + (serverProgress * 0.6);

    setProgress(displayProgress);

    if (data.status === "processing") {
      status.textContent =
        "Cleaning metadata and optimizing video…";

      setTimeout(() => poll(id), 1200);

      return;
    }

    if (data.status === "complete") {
      setProgress(100);

      status.textContent =
        "Complete. Your optimized video is ready.";

      if (data.download) {
        dl.href = data.download;
        dl.classList.remove("hidden");
      }

      return;
    }

    if (data.status === "error") {
      setProgress(0);

      status.textContent =
        data.error || "Processing failed.";

      return;
    }

    setTimeout(() => poll(id), 1200);

  } catch (error) {
    console.error(error);

    setProgress(0);

    status.textContent =
      error.message || "Unable to check processing status.";
  }
      }
