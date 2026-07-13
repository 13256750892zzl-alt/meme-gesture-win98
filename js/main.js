// ????????
import { initDesktop, openWindow, showClippyTip } from "./desktop.js";
import {
  startCamera,
  stopCamera,
  recordGestureSamples,
  isCameraRunning,
  isModelReady,
  resetModel,
  initHandLandmarker,
  checkCameraSupport,
} from "./webcam.js";
import {
  loadGestures,
  upsertGesture,
  deleteGesture,
  normalizeLandmarks,
  averageSamples,
  matchGesture,
  fileToDataUrl,
  exportGestures,
  importGesturesFromFile,
} from "./storage.js";
import { detectGestureStable, BUILTIN_GESTURES, getFingerDebug } from "./gestures.js";
import { MSG } from "./messages.js";

let recordedSamples = null;
let previewImageData = null;

document.addEventListener("DOMContentLoaded", () => {
  initDesktop();
  bindAppEvents();
  renderGestureList();
  renderGestureGuide();
  updateStorageInfo();
  openWindow("webcam");
  openWindow("memes");
  showClippyTip(MSG.welcome);
  const support = checkCameraSupport();
  if (!support.ok) setCameraStatus(support.message, true);
});

function showMessage(text) {
  document.getElementById("msg-text").textContent = text;
  document.getElementById("msg-overlay").classList.remove("hidden");
}

function hideMessage() {
  document.getElementById("msg-overlay").classList.add("hidden");
}

function setCameraStatus(text, isError = false) {
  const el = document.getElementById("camera-status");
  el.textContent = text;
  el.style.color = isError ? "#aa0000" : "#333";
}

function bindAppEvents() {
  const video = document.getElementById("webcam-video");
  const canvas = document.getElementById("webcam-canvas");
  const gestureLabel = document.getElementById("gesture-label");
  const memeImg = document.getElementById("meme-image");
  const memePlaceholder = document.getElementById("meme-placeholder");
  const memeName = document.getElementById("meme-gesture-name");

  document.getElementById("msg-ok").addEventListener("click", hideMessage);

  document.getElementById("btn-start-camera").addEventListener("click", async () => {
    const startBtn = document.getElementById("btn-start-camera");
    const stopBtn = document.getElementById("btn-stop-camera");
    const retryBtn = document.getElementById("btn-retry-model");
    startBtn.disabled = true;
    gestureLabel.textContent = MSG.starting;
    setCameraStatus(MSG.requestingCamera);
    try {
      await startCamera(
        video,
        canvas,
        (landmarks, allHands) => onHandFrame(landmarks, gestureLabel, memeImg, memePlaceholder, memeName, allHands), // ???????
        (msg) => setCameraStatus(msg) // ????
      );
      stopBtn.disabled = false;
      retryBtn.classList.add("hidden");
      gestureLabel.textContent = MSG.detecting;
      setCameraStatus(MSG.cameraRunning);
      showClippyTip(MSG.clippyCameraOk);
    } catch (err) {
      console.error(err);
      if (err.cameraStarted) {
        stopBtn.disabled = false;
        retryBtn.classList.remove("hidden");
        gestureLabel.textContent = MSG.cameraOnly;
        setCameraStatus(err.userMessage || MSG.modelFailPartial, true);
        showMessage(err.userMessage || MSG.modelFailPartial);
        return;
      }
      startBtn.disabled = false;
      gestureLabel.textContent = MSG.startFailed;
      const msg = err.userMessage || getErrorMessage(err);
      setCameraStatus(msg, true);
      showMessage(msg);
    }
  });

  document.getElementById("btn-retry-model").addEventListener("click", async () => {
    const retryBtn = document.getElementById("btn-retry-model");
    retryBtn.disabled = true;
    setCameraStatus(MSG.retryAI);
    resetModel();
    try {
      await initHandLandmarker((msg) => setCameraStatus(msg));
      retryBtn.classList.add("hidden");
      retryBtn.disabled = false;
      document.getElementById("gesture-label").textContent = MSG.detecting;
      setCameraStatus(MSG.aiSuccess);
      showClippyTip(MSG.clippyModelOk);
    } catch (err) {
      retryBtn.disabled = false;
      setCameraStatus(MSG.aiFail, true);
      showMessage(MSG.aiFailDetail);
      console.error(err);
    }
  });

  document.getElementById("btn-stop-camera").addEventListener("click", () => {
    stopCamera(video, canvas);
    document.getElementById("btn-start-camera").disabled = false;
    document.getElementById("btn-stop-camera").disabled = true;
    document.getElementById("btn-retry-model").classList.add("hidden");
    gestureLabel.textContent = MSG.cameraClosed;
    setCameraStatus(MSG.clickToStart);
  });

  document.getElementById("train-image").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    previewImageData = await fileToDataUrl(file);
    const img = document.getElementById("train-preview-img");
    img.src = previewImageData;
    img.classList.remove("hidden");
    checkSaveReady();
  });

  document.getElementById("btn-record-gesture").addEventListener("click", async () => {
    if (!isCameraRunning()) {
      document.getElementById("train-status").textContent = MSG.trainNeedCamera;
      return;
    }
    if (!isModelReady()) {
      document.getElementById("train-status").textContent = MSG.trainNeedAI;
      return;
    }
    const status = document.getElementById("train-status");
    status.textContent = MSG.trainRecording;
    document.getElementById("btn-record-gesture").disabled = true;
    const samples = await recordGestureSamples(3000);
    document.getElementById("btn-record-gesture").disabled = false;
    if (samples.length < 10) {
      status.textContent = MSG.trainNoHand;
      recordedSamples = null;
      return;
    }
    recordedSamples = samples;
    status.textContent = MSG.trainSuccess.replace("{n}", String(samples.length));
    checkSaveReady();
  });

  document.getElementById("btn-save-gesture").addEventListener("click", () => {
    const name = document.getElementById("train-name").value.trim();
    if (!name) {
      document.getElementById("train-status").textContent = MSG.trainNeedName;
      return;
    }
    if (!recordedSamples?.length) {
      document.getElementById("train-status").textContent = MSG.trainNeedRecord;
      return;
    }
    if (!previewImageData) {
      document.getElementById("train-status").textContent = MSG.trainNeedImage;
      return;
    }
    upsertGesture({ name, template: averageSamples(recordedSamples), image: previewImageData });
    document.getElementById("train-name").value = "";
    document.getElementById("train-image").value = "";
    document.getElementById("train-preview-img").classList.add("hidden");
    recordedSamples = null;
    previewImageData = null;
    document.getElementById("btn-save-gesture").disabled = true;
    document.getElementById("train-status").textContent = MSG.trainSaved;
    renderGestureList();
    updateStorageInfo();
    showClippyTip(`\u624b\u52bf\u300c${name}\u300d\u5df2\u4fdd\u5b58\uff0c\u5feb\u8bd5\u8bd5\u5427\uff01`);
  });

  document.getElementById("btn-export").addEventListener("click", () => {
    exportGestures();
    showClippyTip(MSG.clippyExported);
  });

  document.getElementById("btn-import").addEventListener("click", () => {
    document.getElementById("import-file").click();
  });
  document.getElementById("import-file").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await importGesturesFromFile(file);
      renderGestureList();
      updateStorageInfo();
      showClippyTip(MSG.clippyImported);
    } catch {
      showMessage(MSG.importFail);
    }
  });
}

function getErrorMessage(err) {
  if (err.message === "SECURE") return MSG.secureContext;
  if (err.message === "API") return MSG.noApi;
  if (err.message === "MODEL_LOAD_FAILED") return MSG.modelLoadFailed;
  return err.userMessage || MSG.cameraFail;
}

function onHandFrame(landmarks, gestureLabel, memeImg, memePlaceholder, memeName, allHands = null) {
  if (!isModelReady()) {
    gestureLabel.textContent = MSG.waitingAI; // ?? AI
    return;
  }
  if (!landmarks && !(allHands && allHands.length)) {
    gestureLabel.textContent = MSG.noHand; // ?????
    return;
  }
  const matched = detectGestureStable(landmarks, loadGestures(), normalizeLandmarks, matchGesture, allHands); // ????
  if (!matched) {
    gestureLabel.textContent = `${MSG.recognizing} [${getFingerDebug(landmarks)}]`; // ????
    return;
  }
  gestureLabel.textContent = matched.name; // ?????
  openWindow("memes"); // ???????
  memePlaceholder.classList.add("hidden"); // ????
  memeImg.src = matched.image; // ????
  memeImg.onerror = () => {
    memePlaceholder.classList.remove("hidden"); // ????
    memePlaceholder.textContent = `\u56fe\u7247\u52a0\u8f7d\u5931\u8d25: ${matched.image}`; // ??????
  };
  memeImg.classList.remove("hidden"); // ????
  memeName.textContent = MSG.currentGesture + matched.name; // ????
}

function checkSaveReady() {
  const name = document.getElementById("train-name").value.trim();
  document.getElementById("btn-save-gesture").disabled = !(name && recordedSamples?.length && previewImageData);
}

document.addEventListener("input", (e) => {
  if (e.target.id === "train-name") checkSaveReady();
});

function renderGestureList() {
  const list = document.getElementById("gesture-list");
  list.innerHTML = "";
  const builtinTitle = document.createElement("li");
  builtinTitle.innerHTML = `<strong>${MSG.builtinTitle}</strong>`;
  list.appendChild(builtinTitle);
  BUILTIN_GESTURES.forEach((g) => {
    const li = document.createElement("li");
    li.innerHTML = `<img src="${g.image}" alt=""><span>${g.name}</span> <em>${MSG.builtinTag}</em>`;
    list.appendChild(li);
  });
  const customTitle = document.createElement("li");
  customTitle.innerHTML = `<strong>${MSG.customTitle}</strong>`;
  list.appendChild(customTitle);
  const custom = loadGestures();
  if (!custom.length) {
    const empty = document.createElement("li");
    empty.textContent = MSG.customEmpty;
    list.appendChild(empty);
    return;
  }
  custom.forEach((g) => {
    const li = document.createElement("li");
    li.innerHTML = `<img src="${g.image}" alt=""><span>${g.name}</span>`;
    const delBtn = document.createElement("button");
    delBtn.textContent = MSG.delete;
    delBtn.type = "button";
    delBtn.addEventListener("click", () => {
      deleteGesture(g.name);
      renderGestureList();
      updateStorageInfo();
    });
    li.appendChild(delBtn);
    list.appendChild(li);
  });
}

function updateStorageInfo() {
  document.getElementById("storage-info").textContent = String(loadGestures().length + BUILTIN_GESTURES.length);
}

// ????????????
function renderGestureGuide() {
  const box = document.getElementById("gesture-guide-table");
  if (!box) return;
  const custom = loadGestures();
  let html = "<table class=\"guide-table\"><thead><tr><th>\u624b\u52bf</th><th>\u505a\u6cd5</th><th>\u8868\u60c5\u5305</th></tr></thead><tbody>";
  BUILTIN_GESTURES.forEach((g) => {
    html += `<tr><td><strong>${g.name}</strong></td><td>${g.hint || ""}</td><td><img src="${g.image}" alt="" class="guide-thumb"></td></tr>`;
  });
  custom.forEach((g) => {
    html += `<tr><td><strong>${g.name}</strong></td><td>\u81ea\u5b9a\u4e49\u5f55\u5236</td><td><img src="${g.image}" alt="" class="guide-thumb"></td></tr>`;
  });
  html += "</tbody></table>";
  html += `<p class=\"guide-summary\">\u5185\u7f6e ${BUILTIN_GESTURES.length} \u4e2a\u624b\u52bf / \u81ea\u5b9a\u4e49 ${custom.length} \u4e2a / \u5171 ${BUILTIN_GESTURES.length + custom.length} \u4e2a\u8868\u60c5\u5305</p>`;
  box.innerHTML = html;
}
