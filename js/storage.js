// 本地存储键名
const STORAGE_KEY = "meme-gestures-v1"; // 手势数据存储键

// 手势匹配阈值（越小越严格）
const MATCH_THRESHOLD = 0.12; // 欧氏距离阈值

// 录制采样帧数
const RECORD_FRAMES = 45; // 约 1.5 秒 @30fps

// 从 localStorage 读取已保存手势
export function loadGestures() {
  // 读取原始 JSON 字符串
  const raw = localStorage.getItem(STORAGE_KEY); // 获取存储内容
  // 若无数据则返回空数组
  if (!raw) return []; // 默认空列表
  try {
    // 解析 JSON 并返回
    return JSON.parse(raw); // 返回手势数组
  } catch {
    // 解析失败返回空数组
    return []; // 容错处理
  }
}

// 将手势列表写入 localStorage
export function saveGestures(gestures) {
  // 序列化并保存
  localStorage.setItem(STORAGE_KEY, JSON.stringify(gestures)); // 持久化
}

// 添加或更新一个手势
export function upsertGesture(gesture) {
  // 读取现有列表
  const list = loadGestures(); // 当前手势
  // 查找同名手势索引
  const index = list.findIndex((g) => g.name === gesture.name); // 按名称匹配
  if (index >= 0) {
    // 覆盖已有项
    list[index] = gesture; // 更新
  } else {
    // 追加新项
    list.push(gesture); // 新增
  }
  // 写回存储
  saveGestures(list); // 保存
  // 返回最新列表
  return list; // 供 UI 刷新
}

// 删除指定名称的手势
export function deleteGesture(name) {
  // 过滤掉目标手势
  const list = loadGestures().filter((g) => g.name !== name); // 排除
  // 保存结果
  saveGestures(list); // 持久化
  // 返回新列表
  return list; // 供 UI 刷新
}

// 将 File 对象转为 Base64 字符串
export function fileToDataUrl(file) {
  // 返回 Promise 包装的结果
  return new Promise((resolve, reject) => {
    // 创建文件读取器
    const reader = new FileReader(); // 浏览器 API
    // 读取完成回调
    reader.onload = () => resolve(reader.result); // 返回 data URL
    // 读取失败回调
    reader.onerror = () => reject(reader.error); // 抛出错误
    // 以 DataURL 格式读取
    reader.readAsDataURL(file); // 开始读取
  });
}

// 归一化手部关键点（消除位置与尺度影响）
export function normalizeLandmarks(landmarks) {
  // 若无数据直接返回空
  if (!landmarks || landmarks.length === 0) return []; // 空数组
  // 复制一份避免修改原数据
  const points = landmarks.map((p) => ({ x: p.x, y: p.y, z: p.z || 0 })); // 坐标点
  // 取手腕点作为参考中心
  const wrist = points[0]; // 第 0 号点为手腕
  // 平移到原点
  const centered = points.map((p) => ({
    x: p.x - wrist.x, // x 偏移
    y: p.y - wrist.y, // y 偏移
    z: p.z - wrist.z, // z 偏移
  })); // 中心化坐标
  // 计算最大距离用于缩放
  let maxDist = 0; // 初始最大距离
  centered.forEach((p) => {
    // 计算到原点的距离
    const d = Math.hypot(p.x, p.y, p.z); // 欧氏距离
    // 更新最大值
    if (d > maxDist) maxDist = d; // 记录最大
  });
  // 防止除零
  const scale = maxDist || 1; // 缩放因子
  // 归一化并展平为一维数组
  return centered.flatMap((p) => [p.x / scale, p.y / scale, p.z / scale]); // 21*3=63 维
}

// 计算两个归一化向量之间的平均距离
export function landmarkDistance(a, b) {
  // 长度不一致则无法比较
  if (!a.length || a.length !== b.length) return Infinity; // 不匹配
  // 累加各维度差值平方
  let sum = 0; // 平方和
  for (let i = 0; i < a.length; i += 1) {
    // 逐维计算差值
    const diff = a[i] - b[i]; // 差值
    sum += diff * diff; // 平方累加
  }
  // 返回均方根距离
  return Math.sqrt(sum / a.length); // RMS 距离
}

// 将多帧采样平均为一个模板
export function averageSamples(samples) {
  // 无采样返回 null
  if (!samples.length) return null; // 空
  // 向量长度
  const len = samples[0].length; // 维度
  // 初始化累加数组
  const acc = new Array(len).fill(0); // 零向量
  // 累加每一帧
  samples.forEach((sample) => {
    sample.forEach((v, i) => {
      acc[i] += v; // 按维累加
    });
  });
  // 求平均
  return acc.map((v) => v / samples.length); // 均值模板
}

// 与已保存手势进行匹配
export function matchGesture(currentVector, gestures) {
  // 当前向量无效则返回 null
  if (!currentVector || !currentVector.length) return null; // 无法匹配
  // 初始化最佳结果
  let best = null; // 最佳匹配
  let bestDist = Infinity; // 最小距离
  // 遍历所有已保存手势
  gestures.forEach((gesture) => {
    // 计算与模板的距离
    const dist = landmarkDistance(currentVector, gesture.template); // 距离
    // 若更近且低于阈值则更新
    if (dist < bestDist && dist < MATCH_THRESHOLD) {
      bestDist = dist; // 更新距离
      best = gesture; // 更新匹配
    }
  });
  // 返回最佳匹配（可能为 null）
  return best; // 匹配结果
}

// 导出全部数据为 JSON 文件
export function exportGestures() {
  // 读取数据
  const data = loadGestures(); // 手势列表
  // 构造 Blob
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }); // JSON 文件
  // 创建下载链接
  const url = URL.createObjectURL(blob); // 临时 URL
  // 创建 a 标签触发下载
  const a = document.createElement("a"); // 链接元素
  a.href = url; // 设置地址
  a.download = "my-meme-gestures.json"; // 文件名
  a.click(); // 触发下载
  // 释放 URL
  URL.revokeObjectURL(url); // 清理
}

// 从 JSON 文件导入数据
export function importGesturesFromFile(file) {
  // 返回 Promise
  return new Promise((resolve, reject) => {
    // 文件读取器
    const reader = new FileReader(); // 浏览器 API
    // 读取完成
    reader.onload = () => {
      try {
        // 解析 JSON
        const data = JSON.parse(reader.result); // 手势数组
        // 校验是否为数组
        if (!Array.isArray(data)) throw new Error("格式错误"); // 非法格式
        // 写入存储
        saveGestures(data); // 保存
        // 成功回调
        resolve(data); // 返回数据
      } catch (err) {
        // 失败回调
        reject(err); // 抛出错误
      }
    };
    // 读取失败
    reader.onerror = () => reject(reader.error); // 抛出错误
    // 读取文本
    reader.readAsText(file); // 开始读取
  });
}

// 内置默认手势（无需训练即可体验）
export function getDefaultGestures() {
  // 返回空数组，由 UI 引导用户训练；也可在此放演示数据
  return []; // 默认无内置
}

// 导出阈值常量供外部使用
export { MATCH_THRESHOLD, RECORD_FRAMES, STORAGE_KEY }; // 常量导出
