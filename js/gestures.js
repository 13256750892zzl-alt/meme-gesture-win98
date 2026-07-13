// 内置手势与表情包映射（名称与图片素材文件名一致）
export const BUILTIN_GESTURES = [
  { id: "ok", name: "ok", image: "assets/memes/ok.jpg", type: "builtin", hint: "拇指与食指围成圈，中指无名指小指竖起" }, // OK 手势
  { id: "peace", name: "比耶", image: "assets/memes/比耶.jpg", type: "builtin", hint: "食指+中指伸直，无名指小指收拢" }, // 比耶
  { id: "thumbs", name: "点赞", image: "assets/memes/点赞.jpg", type: "builtin", hint: "只有拇指朝上，其余收拢" }, // 点赞
  { id: "fist", name: "攥拳", image: "assets/memes/攥拳.jpg", type: "builtin", hint: "五指全部收拢成拳" }, // 攥拳
  { id: "cross", name: "交叉手臂", image: "assets/memes/交叉手臂.jpg", type: "builtin", hint: "两只手臂在胸前交叉成 X" }, // 交叉手臂
  { id: "six", name: "6", image: "assets/memes/6.jpg", type: "builtin", hint: "拇指+小指伸出，其余收拢" }, // 比六
  { id: "cover", name: "捂嘴", image: "assets/memes/捂嘴.jpg", type: "builtin", hint: "双手手背朝镜头，并拢捂在嘴前（如图）" }, // 捂嘴
];

// 计算两点距离
function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0)); // 三维欧氏距离
}

// 掌心中心点
function palmCenter(lm) {
  return {
    x: (lm[0].x + lm[5].x + lm[9].x + lm[17].x) / 4, // 腕+三指根平均 x
    y: (lm[0].y + lm[5].y + lm[9].y + lm[17].y) / 4, // 腕+三指根平均 y
  }; // 返回掌心
}

// 单只手是否为「捂嘴」姿势：手背朝镜头、四指伸直并拢、抬到脸前
function isOneCoverHand(lm) {
  if (!lm || lm.length < 21) return false; // 无效
  const f = fingerStates(lm); // 手指状态
  const upCount = [f.index, f.middle, f.ring, f.pinky].filter(Boolean).length; // 伸直数
  if (upCount < 3) return false; // 至少三指伸直（平手捂嘴）
  const tips = [lm[8], lm[12], lm[16], lm[20]]; // 四指尖
  const tipSpread = Math.max(...tips.map((t) => t.x)) - Math.min(...tips.map((t) => t.x)); // 横向跨度
  if (tipSpread > 0.34) return false; // 手指需并拢，不能大幅张开
  const c = palmCenter(lm); // 掌心
  if (c.y > 0.52) return false; // 必须抬到脸/嘴附近（比胸前交叉更高）
  if (c.x < 0.12 || c.x > 0.88) return false; // 水平靠近脸部
  // 手背朝镜头：掌心法向 z 为正；若深度不稳，只要手指并拢抬脸也放宽通过
  const nz = palmNormalZ(lm); // 掌心法向
  if (nz < -0.012) return false; // 明显掌心朝镜头则排除
  return true; // 符合单手捂嘴
}

// 掌心法向 z：负值偏掌心朝镜头，正值偏手背朝镜头
function palmNormalZ(lm) {
  const w = lm[0]; // 手腕
  const i = lm[5]; // 食指 MCP
  const p = lm[17]; // 小指 MCP
  const ax = i.x - w.x; // 腕→食指 x
  const ay = i.y - w.y; // 腕→食指 y
  const az = (i.z || 0) - (w.z || 0); // 腕→食指 z
  const bx = p.x - w.x; // 腕→小指 x
  const by = p.y - w.y; // 腕→小指 y
  const bz = (p.z || 0) - (w.z || 0); // 腕→小指 z
  return ax * by - ay * bx + (ay * bz - az * by) * 0.15 + (az * bx - ax * bz) * 0.15; // 平面叉积为主
}

// 捂嘴：必须双手，都像截图那样捂在嘴前
function isCoverMouth(multiHands) {
  if (!multiHands || multiHands.length < 2) return false; // 必须双手
  const a = multiHands[0]; // 左手/第一只
  const b = multiHands[1]; // 右手/第二只
  if (!isOneCoverHand(a) || !isOneCoverHand(b)) return false; // 两只都要符合姿势
  const ca = palmCenter(a); // 掌心 A
  const cb = palmCenter(b); // 掌心 B
  const apart = Math.hypot(ca.x - cb.x, ca.y - cb.y); // 双手间距
  if (apart > 0.38) return false; // 必须都捂在嘴附近，不能分太开
  // 排除交叉手臂：捂嘴时双手都在脸部偏上，掌心都偏高
  const avgY = (ca.y + cb.y) / 2; // 平均高度
  return avgY < 0.50; // 确认在脸部区域（高于胸前交叉）
}

// 判断两线段是否相交（用于交叉手臂）
function segmentsIntersect(p1, p2, p3, p4) {
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x); // 叉积
  const d1 = cross(p3, p4, p1); // p1 相对线段34
  const d2 = cross(p3, p4, p2); // p2 相对线段34
  const d3 = cross(p1, p2, p3); // p3 相对线段12
  const d4 = cross(p1, p2, p4); // p4 相对线段12
  if (d1 * d2 >= 0 || d3 * d4 >= 0) return false; // 未跨立则不相交
  return true; // 两线段跨立即相交
}

// 四指是否伸直（用 tip 与 pip 的 y 坐标，y 越小越靠上）
function isFingerUp(lm, tip, pip, mcp) {
  const tipY = lm[tip].y; // 指尖 y
  const pipY = lm[pip].y; // 第二关节 y
  const mcpY = lm[mcp].y; // 掌指关节 y
  return tipY < pipY - 0.02 && pipY <= mcpY + 0.05; // 指尖高于 pip
}

// 拇指是否竖起（点赞）
function isThumbUp(lm) {
  const tip = lm[4]; // 拇指尖
  const ip = lm[3]; // 拇指 ip
  const indexMcp = lm[5]; // 食指根部
  return tip.y < ip.y - 0.02 && dist(tip, indexMcp) > 0.06; // 拇指朝上且离开食指
}

// 拇指是否伸出（比六用）
function isThumbOut(lm) {
  const tip = lm[4]; // 拇指尖
  const wrist = lm[0]; // 手腕
  return dist(tip, wrist) > 0.14; // 拇指展开
}

// 获取四指伸直状态
function fingerStates(lm) {
  return {
    index: isFingerUp(lm, 8, 6, 5), // 食指
    middle: isFingerUp(lm, 12, 10, 9), // 中指
    ring: isFingerUp(lm, 16, 14, 13), // 无名指
    pinky: isFingerUp(lm, 20, 18, 17), // 小指
    thumbUp: isThumbUp(lm), // 拇指朝上
    thumbOut: isThumbOut(lm), // 拇指展开
  }; // 返回状态对象
}

// 检测交叉手臂：两只手前臂（手腕→中指根）在画面中相交
function detectCrossedArms(multiHands) {
  if (!multiHands || multiHands.length < 2) return false; // 需要双手
  const a = multiHands[0]; // 第一只手
  const b = multiHands[1]; // 第二只手
  if (!a?.length || !b?.length) return false; // 无效关键点
  const wa = a[0]; // 手腕 A
  const wb = b[0]; // 手腕 B
  const ma = a[9]; // 中指 MCP A（近似前臂末端）
  const mb = b[9]; // 中指 MCP B
  if (Math.abs(wa.y - wb.y) > 0.28) return false; // 高度差过大则不是胸前交叉
  if (dist(wa, wb) > 0.5) return false; // 手腕过远
  // 前臂线段相交，或双手掌心在对方手腕对侧（镜像交叉）
  if (segmentsIntersect(wa, ma, wb, mb)) return true; // 线段相交
  const palmsCross = (wa.x - wb.x) * (ma.x - mb.x) < 0; // 手腕与掌心相对位置相反
  const closeEnough = dist(ma, mb) < 0.35; // 掌心不太远
  return palmsCross && closeEnough; // 交叉判定
}

// 内置手势识别（可传入多只手）
export function detectBuiltinGesture(landmarks, multiHands = null) {
  const hands = multiHands || (landmarks ? [landmarks] : null); // 手列表

  // 捂嘴：双手捂嘴（优先于交叉手臂，避免脸前双手被误判）
  if (isCoverMouth(hands)) {
    return BUILTIN_GESTURES.find((g) => g.id === "cover"); // 捂嘴
  }

  // 交叉手臂（双手胸前交叉）
  if (detectCrossedArms(hands)) {
    return BUILTIN_GESTURES.find((g) => g.id === "cross"); // 交叉手臂
  }

  if (!landmarks || landmarks.length < 21) return null; // 无效单手输入
  const f = fingerStates(landmarks); // 各指状态
  const thumbTip = landmarks[4]; // 拇指尖
  const indexTip = landmarks[8]; // 食指尖（OK 成圈用）
  const thumbIndexDist = dist(thumbTip, indexTip); // 拇指食指距离
  const handSize = dist(landmarks[0], landmarks[9]) || 0.2; // 手掌尺度（手腕到中指根）
  const okCircle = thumbIndexDist < Math.max(0.055, handSize * 0.42); // 拇指食指围成圈（相对手掌大小）

  // OK：拇指+食指成圈，中指/无名指/小指竖起（食指弯曲触碰拇指，可不算伸直）
  if (okCircle && f.middle && f.ring && f.pinky) {
    return BUILTIN_GESTURES.find((g) => g.id === "ok"); // ok
  }

  // 比耶：食指+中指伸，无名指和小指收
  if (f.index && f.middle && !f.ring && !f.pinky) {
    return BUILTIN_GESTURES.find((g) => g.id === "peace"); // 比耶
  }

  // 比六：拇指+小指伸，其余收
  if (f.thumbOut && f.pinky && !f.index && !f.middle && !f.ring) {
    return BUILTIN_GESTURES.find((g) => g.id === "six"); // 6
  }

  // 点赞：只有拇指竖起
  if (f.thumbUp && !f.index && !f.middle && !f.ring && !f.pinky) {
    return BUILTIN_GESTURES.find((g) => g.id === "thumbs"); // 点赞
  }

  // 四指全收：攥拳
  if (!f.index && !f.middle && !f.ring && !f.pinky) {
    return BUILTIN_GESTURES.find((g) => g.id === "fist"); // 攥拳
  }

  return null; // 未匹配
}

// 防抖状态
let lastGestureId = null; // 上次 ID
let stableCount = 0; // 稳定帧
let nullCount = 0; // 连续空帧
const STABLE_FRAMES = 2; // 连续 2 帧即确认（降低延迟）

// 稳定识别（内置 + 自定义）
export function detectGestureStable(landmarks, customGestures, normalizeFn, matchFn, multiHands = null) {
  let detected = null; // 当前帧结果
  // 优先自定义手势
  if (landmarks && customGestures.length) {
    const vector = normalizeFn(landmarks); // 归一化
    const custom = matchFn(vector, customGestures); // 模板匹配
    if (custom) {
      detected = { id: custom.name, name: custom.name, image: custom.image, type: "custom" }; // 自定义结果
    }
  }
  // 内置手势（含双手交叉手臂）
  if (!detected) detected = detectBuiltinGesture(landmarks, multiHands); // 启发式
  if (detected) {
    nullCount = 0; // 重置空帧
    return stabilize(detected); // 防抖
  }
  // 连续多帧无识别才重置（避免抖动）
  nullCount += 1; // 累加空帧
  if (nullCount > 5) {
    lastGestureId = null; // 清空
    stableCount = 0; // 重置
  }
  return null; // 本帧无结果
}

// 防抖器
function stabilize(gesture) {
  if (gesture.id === lastGestureId) stableCount += 1; // 相同则累加
  else {
    lastGestureId = gesture.id; // 新的手势
    stableCount = 1; // 重置计数
  }
  if (stableCount >= STABLE_FRAMES) return gesture; // 确认
  return null; // 尚未稳定
}

// 导出手指状态供调试显示
export function getFingerDebug(lm) {
  if (!lm) return ""; // 无手
  const f = fingerStates(lm); // 状态
  const parts = []; // 文字片段
  if (f.index) parts.push("食"); // 食指
  if (f.middle) parts.push("中"); // 中指
  if (f.ring) parts.push("无"); // 无名指
  if (f.pinky) parts.push("小"); // 小指
  if (f.thumbUp || f.thumbOut) parts.push("拇"); // 拇指
  return parts.length ? parts.join("") : "收"; // 默认收拢
}

// 获取全部手势清单（供 UI 展示）
export function getGestureCatalog() {
  return BUILTIN_GESTURES.map((g) => ({
    name: g.name, // 名称
    image: g.image, // 图片
    hint: g.hint, // 做法提示
    type: "内置", // 类型
  }));
}
