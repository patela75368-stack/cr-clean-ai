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

const stepUpload =
  document.getElementById("stepUpload");

const stepProcess =
  document.getElementById("stepProcess");

const stepDone =
  document.getElementById("stepDone");


let processing = false;


/*
 * Choose video
 */
choose.onclick = () => {

  if (processing) return;

  file.click();

};


/*
 * File selected
 */
file.onchange = () => {

  if (
    file.files &&
    file.files[0]
  ) {

    processVideo(
      file.files[0]
    );

  }

};


/*
 * Drag & drop
 */
drop.ondragover = (event) => {

  event.preventDefault();

  if (!processing) {

    drop.style.borderColor =
      "#7564ff";

  }

};


drop.ondragleave = () => {

  drop.style.borderColor =
    "";

};


drop.ondrop = (event) => {

  event.preventDefault();

  drop.style.borderColor =
    "";

  if (processing) return;


  const selected =
    event.dataTransfer.files[0];


  if (selected) {

    processVideo(
      selected
    );

  }

};


/*
 * Process another video
 */
newVideo.onclick = () => {

  processing = false;

  file.disabled = false;

  choose.disabled = false;

  file.value = "";

  work.classList.add(
    "hidden"
  );

  download.classList.add(
    "hidden"
  );

  newVideo.classList.add(
    "hidden"
  );

  setProgress(0);

  resetSteps();

  status.textContent =
    "Uploading your video…";

  fileMeta.textContent =
    "Preparing video";

};


/*
 * File size
 */
function formatSize(bytes) {

  if (!bytes) {
    return "0 MB";
  }


  const mb =
    bytes /
    (1024 * 1024);


  if (mb < 1) {

    return `${Math.round(
      bytes / 1024
    )} KB`;

  }


  return `${mb.toFixed(1)} MB`;

}


/*
 * Progress
 */
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


/*
 * Steps
 */
function resetSteps() {

  stepUpload.classList.add(
    "active"
  );

  stepProcess.classList.remove(
    "active"
  );

  stepDone.classList.remove(
    "active"
  );

}


function processingStep() {

  stepUpload.classList.add(
    "active"
  );

  stepProcess.classList.add(
    "active"
  );

  stepDone.classList.remove(
    "active"
  );

}


function completeStep() {

  stepUpload.classList.add(
    "active"
  );

  stepProcess.classList.add(
    "active"
  );

  stepDone.classList.add(
    "active"
  );

}


/*
 * Main process
 */
function processVideo(videoFile) {

  if (!videoFile) {
    return;
  }


  if (
    processing
  ) {
    return;
  }


  /*
   * Client-side size check
   */
  if (
    videoFile.size >
    100 * 1024 * 1024
  ) {

    alert(
      "Maximum file size is 100 MB."
    );

    return;
  }


  /*
   * Basic client-side type check
   */
  const allowedTypes = [
    "video/mp4",
    "video/webm",
    "video/quicktime",
    "video/x-matroska"
  ];


  if (
    videoFile.type &&
    !allowedTypes.includes(
      videoFile.type
    )
  ) {

    alert(
      "Only MP4, WebM, MOV or MKV videos are allowed."
    );

    return;
  }


  processing = true;

  file.disabled = true;

  choose.disabled = true;


  nameEl.textContent =
    videoFile.name;


  fileMeta.textContent =
    `${formatSize(
      videoFile.size
    )} • Uploading`;


  work.classList.remove(
    "hidden"
  );


  download.classList.add(
    "hidden"
  );

  newVideo.classList.add(
    "hidden"
  );


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


  /*
   * Upload progress
   */
  xhr.upload.onprogress =
    (event) => {

      if (
        !event.lengthComputable
      ) {
        return;
      }


      const uploadPercent =
        (
          event.loaded /
          event.total
        ) * 40;


      setProgress(
        uploadPercent
      );


      fileMeta.textContent =
        `${formatSize(
          videoFile.size
        )} • Uploading`;


      status.textContent =
        `Uploading your video… ${Math.round(
          uploadPercent
        )}%`;

    };


  /*
   * Server response
   */
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


      processing = false;

      file.disabled = false;

      choose.disabled = false;


      setProgress(0);

      status.textContent =
        message;

      fileMeta.textContent =
        "Upload failed";

      return;
    }


    let data;


    try {

      data =
        JSON.parse(
          xhr.responseText
        );

    } catch {

      processing = false;

      file.disabled = false;

      choose.disabled = false;

      setProgress(0);

      status.textContent =
        "Invalid server response.";

      return;
    }


    if (!data.id) {

      processing = false;

      file.disabled = false;

      choose.disabled = false;

      setProgress(0);

      status.textContent =
        "Server did not return a processing ID.";

      return;
    }


    setProgress(40);

    processingStep();


    fileMeta.textContent =
      `${formatSize(
        videoFile.size
      )} • Processing`;


    status.textContent =
      "Upload complete. Optimizing your video…";


    poll(data.id);

  };


  /*
   * Network error
   */
  xhr.onerror = () => {

    processing = false;

    file.disabled = false;

    choose.disabled = false;

    setProgress(0);

    status.textContent =
      "Network error. Please try again.";

  };


  /*
   * Timeout
   */
  xhr.timeout =
    10 * 60 * 1000;


  xhr.ontimeout = () => {

    processing = false;

    file.disabled = false;

    choose.disabled = false;

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


  xhr.send(
    formData
  );

}


/*
 * Poll processing status
 */
async function poll(id) {

  try {

    const response =
      await fetch(
        `/api/status/${id}`,
        {
          cache: "no-store"
        }
      );


    const data =
      await response.json();


    if (!response.ok) {

      throw new Error(
        data.error ||
        "Unable to check processing status."
      );

    }


    const serverProgress =
      Number(
        data.progress
      ) || 0;


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

      fileMeta.textContent =
        "Processing with FFmpeg";

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


      fileMeta.textContent =
        "Processing complete";


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


      processing = false;

      file.disabled = false;

      choose.disabled = false;


      return;
    }


    if (
      data.status ===
      "error"
    ) {

      processing = false;

      file.disabled = false;

      choose.disabled = false;


      setProgress(0);


      fileMeta.textContent =
        "Processing failed";


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

    console.error(
      error
    );


    processing = false;

    file.disabled = false;

    choose.disabled = false;


    setProgress(0);


    status.textContent =
      error.message ||
      "Unable to check processing status.";

  }

  }
