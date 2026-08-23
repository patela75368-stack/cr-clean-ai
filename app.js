const file = document.getElementById("file");
const choose = document.getElementById("choose");
const drop = document.getElementById("drop");

const work = document.getElementById("work");

const nameEl = document.getElementById("name");
const fileMeta = document.getElementById("fileMeta");

const pct = document.getElementById("pct");
const fill = document.getElementById("fill");
const status = document.getElementById("status");

const download = document.getElementById("download");
const newVideo = document.getElementById("newVideo");

const stepUpload = document.getElementById("stepUpload");
const stepProcess = document.getElementById("stepProcess");
const stepDone = document.getElementById("stepDone");


choose.onclick = () => {
  file.click();
};


file.onchange = () => {
  if (file.files[0]) {
    processVideo(file.files[0]);
  }
};


drop.ondragover = (event) => {
  event.preventDefault();
  drop.style.borderColor = "#7564ff";
};


drop.ondragleave = () => {
  drop.style.borderColor = "";
};


drop.ondrop = (event) => {

  event.preventDefault();

  drop.style.borderColor = "";

  const selected = event.dataTransfer.files[0];

  if (selected) {
    processVideo(selected);
  }
};


newVideo.onclick = () => {

  file.value = "";

  work.classList.add("hidden");

  download.classList.add("hidden");
  newVideo.classList.add("hidden");

  setProgress(0);

  resetSteps();

  status.textContent =
    "Uploading your video…";

  fileMeta.textContent =
    "Preparing video";
};


function formatSize(bytes) {

  if (!bytes) return "0 MB";

  const mb = bytes / (1024 * 1024);

  if (mb < 1) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${mb.toFixed(1)} MB`;
}


function setProgress(value) {

  const p =
    Math.max(
      0,
      Math.min(
        100,
        Math.round(value)
      )
    );

  pct.textContent =
    `${p}%`;

  fill.style.width =
    `${p}%`;
}


function resetSteps() {

  stepUpload.classList.add("active");
  stepProcess.classList.remove("active");
  stepDone.classList.remove("active");
}


function processingStep() {

  stepUpload.classList.add("active");
  stepProcess.classList.add("active");
  stepDone.classList.remove("active");
}


function completeStep() {

  stepUpload.classList.add("active");
  stepProcess.classList.add("active");
  stepDone.classList.add("active");
}


function processVideo(videoFile) {

  if (!videoFile) {
    return;
  }


  if (videoFile.size > 100 * 1024 * 1024) {

    alert(
      "Maximum file size is 100 MB."
    );

    return;
  }


  nameEl.textContent =
    videoFile.name;

  fileMeta.textContent =
    `${formatSize(videoFile.size)} • Ready`;


  work.classList.remove("hidden");

  download.classList.add("hidden");
  newVideo.classList.add("hidden");


  resetSteps();

  setProgress(0);

  status.textContent =
    "Uploading your video…";


  const xhr =
    new XMLHttpRequest();


  xhr.open(
    "POST",
    "/api/process",
    true
  );


  xhr.upload.onprogress =
    (event) => {

      if (!event.lengthComputable) {
        return;
      }


      const uploadPercent =
        (event.loaded / event.total) * 40;


      setProgress(
        uploadPercent
      );


      status.textContent =
        `Uploading your video… ${Math.round(uploadPercent)}%`;

    };


  xhr.onload = () => {

    if (
      xhr.status < 200 ||
      xhr.status >= 300
    ) {

      let message =
        "Upload failed.";

      try {

        const data =
          JSON.parse(
            xhr.responseText
          );

        message =
          data.error ||
          message;

      } catch {}


      status.textContent =
        message;

      setProgress(0);

      return;
    }


    let data;

    try {

      data =
        JSON.parse(
          xhr.responseText
        );

    } catch {

      status.textContent =
        "Invalid server response.";

      setProgress(0);

      return;
    }


    if (!data.id) {

      status.textContent =
        "Server did not return a processing ID.";

      setProgress(0);

      return;
    }


    setProgress(40);

    processingStep();

    status.textContent =
      "Upload complete. Optimizing your video…";


    poll(data.id);
  };


  xhr.onerror = () => {

    setProgress(0);

    status.textContent =
      "Network error. Please try again.";
  };


  xhr.timeout =
    10 * 60 * 1000;


  xhr.ontimeout = () => {

    setProgress(0);

    status.textContent =
      "Upload timed out. Please try a smaller video.";
  };


  const formData =
    new FormData();

  formData.append(
    "video",
    videoFile
  );


  xhr.send(formData);
}


async function poll(id) {

  try {

    const response =
      await fetch(
        `/api/status/${id}`
      );


    const data =
      await response.json();


    if (!response.ok) {

      throw new Error(
        data.error ||
        "Unable to check status."
      );
    }


    const serverProgress =
      Number(data.progress) || 0;


    const displayProgress =
      40 +
      serverProgress * 0.6;


    setProgress(
      displayProgress
    );


    if (
      data.status ===
      "processing"
    ) {

      processingStep();

      status.textContent =
        "Cleaning metadata and optimizing video…";


      setTimeout(
        () => poll(id),
        1200
      );

      return;
    }


    if (
      data.status ===
      "complete"
    ) {

      setProgress(100);

      completeStep();

      status.textContent =
        "Complete. Your optimized video is ready.";


      if (data.download) {

        download.href =
          data.download;

        download.classList.remove(
          "hidden"
        );

        newVideo.classList.remove(
          "hidden"
        );
      }

      return;
    }


    if (
      data.status ===
      "error"
    ) {

      setProgress(0);

      status.textContent =
        data.error ||
        "Processing failed.";

      return;
    }


    setTimeout(
      () => poll(id),
      1200
    );

  } catch (error) {

    console.error(error);

    setProgress(0);

    status.textContent =
      error.message ||
      "Unable to check processing status.";
  }
  }
