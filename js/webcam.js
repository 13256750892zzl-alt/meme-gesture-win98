// MediaPipe Hands 版本号（全部资源走 jsDelivr）
import { MSG } from "./messages.js";

const HANDS_VERSION = "0.4.1675469240";

// CDN 根路径
const CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/hands@${HANDS_VERSION}`; // 资源目录

// Hands 实例
let hands = null; // 检测器

// 是否正在运行
let running = false; // 运行标志

// 摄像头流
let mediaStream = null; // MediaStream

// 动画帧 ID
let rafId = null; // RAF

// 最新手部关键点（第一只手，兼容旧逻辑）
let latestLandmarks = null; // 21 点

// 最新全部手部关键点（最多两只）
let latestAllHands = null; // 多手数组

// 帧回调
let onFrame = null; // 外部回调

// 模型是否就绪
let modelReady = false; // 就绪标志

// 检查浏览器摄像头支持
export function checkCameraSupport() {
  if (!window.isSecureContext) {
    return { ok: false, code: "SECURE", message: MSG.wmSecure };
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return { ok: false, code: "API", message: MSG.wmNoApi };
  }
  return { ok: true, code: "OK", message: "" };
}

// 动态加载 MediaPipe Hands 脚本
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`); // 已加载则跳过
    if (existing) {
      resolve(); // 直接完成
      return;
    }
    const script = document.createElement("script"); // script 标签
    script.src = src; // 地址
    script.crossOrigin = "anonymous"; // 跨域
    script.onload = () => resolve(); // 成功
    script.onerror = () => reject(new Error(`脚本加载失败: ${src}`)); // 失败
    document.head.appendChild(script); // 插入页面
  });
}

// 初始化 MediaPipe Hands
export async function initHandLandmarker(onProgress) {
  if (hands && modelReady) return hands; // 已初始化
  onProgress?.(MSG.wmLoading);
  // 加载 hands.js（全局暴露 Hands 类）
  await loadScript(`${CDN}/hands.js`); // 主脚本
  // 确认全局 Hands 存在
  if (!window.Hands) {
    throw new Error("Hands 类未加载"); // 加载失败
  }
  // 创建实例
  hands = new window.Hands({
    locateFile: (file) => `${CDN}/${file}`, // 所有 wasm/模型走 jsDelivr
  });
  // 配置参数
  hands.setOptions({
    maxNumHands: 2, // 最多两只手
    modelComplexity: 1, // 模型复杂度
    minDetectionConfidence: 0.6, // 检测阈值
    minTrackingConfidence: 0.6, // 跟踪阈值
  });
  // 注册结果回调
  hands.onResults((results) => {
    latestAllHands = results.multiHandLandmarks?.length ? results.multiHandLandmarks : null; // 全部手
    latestLandmarks = latestAllHands?.[0] || null; // 取第一只手
  });
  modelReady = true; // 标记就绪
  onProgress?.(MSG.wmReady);
  return hands; // 返回
}

// 打开摄像头流
async function openCameraStream(videoEl) {
  const support = checkCameraSupport(); // 环境检查
  if (!support.ok) {
    const err = new Error(support.code); // 错误码
    err.userMessage = support.message; // 提示
    throw err;
  }
  const constraintsList = [
    { video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false },
    { video: { facingMode: "user" }, audio: false },
    { video: true, audio: false },
  ]; // 约束列表
  let lastErr = null; // 最后错误
  for (const constraints of constraintsList) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints); // 请求摄像头
    } catch (err) {
      lastErr = err; // 记录
    }
  }
  const err = new Error("CAMERA_DENIED"); // 错误
  err.cause = lastErr;
  if (lastErr?.name === "NotAllowedError") {
    err.userMessage = MSG.wmDenied;
  } else if (lastErr?.name === "NotFoundError") {
    err.userMessage = MSG.wmNotFound;
  } else if (lastErr?.name === "NotReadableError") {
    err.userMessage = MSG.wmBusy;
  } else {
    err.userMessage = MSG.wmGeneric;
  }
  throw err;
}

// 开启摄像头并开始检测
export async function startCamera(videoEl, canvasEl, frameCallback, onProgress) {
  onFrame = frameCallback; // 保存回调
  onProgress?.(MSG.wmRequestCamera);
  // 先开摄像头
  mediaStream = await openCameraStream(videoEl); // 获取流
  videoEl.srcObject = mediaStream; // 绑定
  await new Promise((resolve, reject) => {
    videoEl.onloadedmetadata = () => resolve(); // 元数据
    videoEl.onerror = () => reject(new Error("VIDEO_ERROR")); // 错误
    videoEl.play().catch(reject); // 播放
  });
  canvasEl.width = videoEl.videoWidth || 640; // 画布宽
  canvasEl.height = videoEl.videoHeight || 480; // 画布高
  running = true; // 开始运行
  // 加载 AI 模型
  try {
    await initHandLandmarker(onProgress); // 初始化 Hands
  } catch (err) {
    detectLoop(videoEl, canvasEl); // 降级：仅显示画面
    const warn = new Error("MODEL_ONLY_FAILED"); // 特殊错误
    warn.userMessage = MSG.wmPartial;
    warn.cameraStarted = true; // 摄像头 OK
    throw warn;
  }
  detectLoop(videoEl, canvasEl); // 检测循环
  return true;
}

// 停止摄像头
export function stopCamera(videoEl, canvasEl) {
  running = false; // 停止
  if (rafId) cancelAnimationFrame(rafId); // 取消 RAF
  if (mediaStream) {
    mediaStream.getTracks().forEach((t) => t.stop()); // 释放
    mediaStream = null;
  }
  videoEl.srcObject = null; // 清空
  const ctx = canvasEl.getContext("2d"); // 画布
  ctx.clearRect(0, 0, canvasEl.width, canvasEl.height); // 清屏
  latestLandmarks = null; // 重置单手
  latestAllHands = null; // 重置双手
}

// 检测循环
async function detectLoop(videoEl, canvasEl) {
  if (!running) return; // 已停止
  if (videoEl.readyState >= 2) {
    const ctx = canvasEl.getContext("2d"); // 画布上下文
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height); // 清屏
    // AI 就绪时发送帧给 MediaPipe
    if (hands && modelReady) {
      try {
        await hands.send({ image: videoEl }); // 检测
        if (latestAllHands) {
          latestAllHands.forEach((lm) => {
            drawLandmarks(ctx, lm, canvasEl.width, canvasEl.height); // 绘制每只手
          });
        }
      } catch (err) {
        console.warn("Hands 检测异常:", err); // 日志
      }
    }
    if (onFrame) onFrame(latestLandmarks, latestAllHands); // 回调（单手 + 全部手）
  }
  rafId = requestAnimationFrame(() => detectLoop(videoEl, canvasEl)); // 下一帧
}

// 绘制手部骨架
function drawLandmarks(ctx, landmarks, width, height) {
  ctx.strokeStyle = "#00ff00"; // 绿色
  ctx.lineWidth = 2; // 线宽
  ctx.fillStyle = "#00ff00"; // 绿色点
  const connections = [
    [0, 1], [1, 2], [2, 3], [3, 4],
    [0, 5], [5, 6], [6, 7], [7, 8],
    [0, 9], [9, 10], [10, 11], [11, 12],
    [0, 13], [13, 14], [14, 15], [15, 16],
    [0, 17], [17, 18], [18, 19], [19, 20],
    [5, 9], [9, 13], [13, 17],
  ]; // 连接
  connections.forEach(([a, b]) => {
    const p1 = landmarks[a]; // 起点
    const p2 = landmarks[b]; // 终点
    ctx.beginPath();
    ctx.moveTo(p1.x * width, p1.y * height);
    ctx.lineTo(p2.x * width, p2.y * height);
    ctx.stroke();
  });
  landmarks.forEach((p) => {
    ctx.beginPath();
    ctx.arc(p.x * width, p.y * height, 3, 0, Math.PI * 2);
    ctx.fill();
  });
}

// 获取最新关键点
export function getLatestLandmarks() {
  return latestLandmarks;
}

// 摄像头是否运行
export function isCameraRunning() {
  return running;
}

// AI 是否就绪
export function isModelReady() {
  return modelReady && !!hands;
}

// 重置模型（重试用）
export function resetModel() {
  hands = null; // 清空
  modelReady = false; // 重置
}

// 录制手势样本
export async function recordGestureSamples(durationMs = 3000) {
  const samples = []; // 样本
  const start = performance.now(); // 开始
  const { normalizeLandmarks } = await import("./storage.js"); // 归一化
  return new Promise((resolve) => {
    const timer = setInterval(() => {
      if (latestLandmarks) samples.push(normalizeLandmarks(latestLandmarks)); // 采样
      if (performance.now() - start >= durationMs) {
        clearInterval(timer); // 停止
        resolve(samples); // 返回
      }
    }, 66); // ~15fps
  });
}
