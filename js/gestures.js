// 内置手势与表情包映射（名称与图片素材文件名一致）
export const BUILTIN_GESTURES = [
  { id: "ok", name: "ok", image: "assets/memes/ok.jpg", type: "builtin", hint: "拇指与食指围成圈，中指无名指小指竖起" }, // OK 手势
  { id: "peace", name: "比耶", image: "assets/memes/比耶.jpg", type: "builtin", hint: "食指+中指伸直，无名指小指收拢" }, // 比耶
  { id: "thumbs", name: "点赞", image: "assets/memes/点赞.jpg", type: "builtin", hint: "只有拇指朝上，其余收拢" }, // 点赞
  { id: "fist", name: "攥拳", image: "assets/memes/攥拳.jpg", type: "builtin", hint: "五指全部收拢成拳（拇指也收在拳侧）" }, // 攥拳
  { id: "cross", name: "交叉手臂", image: "assets/memes/交叉手臂.jpg", type: "builtin", hint: "双手胸前交叉成 X，五指并拢伸直（可略露掌心）" }, // 交叉手臂
  { id: "six", name: "6", image: "assets/memes/6.jpg", type: "builtin", hint: "拇指+小指伸出，其余收拢" }, // 比六
  { id: "heart", name: "比心", image: "assets/memes/比心.jpg", type: "builtin", hint: "大拇指和食指伸出来，指尖贴近比成心形，其余三指收拢" }, // 比心
  { id: "think", name: "思考", image: "assets/memes/思考.jpg", type: "builtin", hint: "拇指+食指伸出成 L/V 托下巴，其余三指收拢" }, // 思考
  { id: "pray", name: "祝福", image: "assets/memes/祝福.jpg", type: "builtin", hint: "双手合十，掌心相对、手指朝上" }, // 双手合十祝福
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

// 拇指是否伸出（比六 / 思考用）
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

// 比心：大拇指和食指伸出来，指尖贴近成心；中指/无名指/小指收拢（与攥拳严格区分）
function isFingerHeart(lm, f, thumbIndexDist, handSize) {
  if (f.middle || f.ring || f.pinky) return false; // 其余三指必须收拢（区别于 OK）
  const tipsClose = thumbIndexDist < Math.max(0.05, handSize * 0.38); // 拇食指尖贴近成心
  if (!tipsClose) return false; // 未成心

  const thumbTip = lm[4]; // 拇指尖
  const indexTip = lm[8]; // 食指尖
  const wrist = lm[0]; // 手腕
  const palm = palmCenter(lm); // 掌心

  // 拇、食指必须明显「伸出来」（攥拳时指尖贴在拳面，伸出很短）
  const thumbReach = dist(thumbTip, wrist); // 拇指伸出长度
  const indexReach = dist(indexTip, wrist); // 食指伸出长度
  if (thumbReach < handSize * 0.85) return false; // 拇指未真正伸出 → 攥拳
  if (indexReach < handSize * 0.85) return false; // 食指未真正伸出 → 攥拳

  // 成心交汇点须明显离开掌心（攥拳拇指压在拳面，交汇贴近掌心）
  const meet = { x: (thumbTip.x + indexTip.x) / 2, y: (thumbTip.y + indexTip.y) / 2 }; // 指尖交汇点
  if (dist(meet, palm) < handSize * 0.55) return false; // 交汇太近掌心 → 攥拳

  // 拇、食指尖本身也要离开掌心（真正伸出去比心）
  if (dist(indexTip, palm) < handSize * 0.5) return false; // 食指尖贴掌
  if (dist(thumbTip, palm) < handSize * 0.5) return false; // 拇指尖贴掌

  return true; // 符合比心
}

// 攥拳：五指全部收拢成拳（拇指也收在拳侧，不伸出比心）
function isFist(lm, f, handSize) {
  if (f.index || f.middle || f.ring || f.pinky) return false; // 四指须全部收拢

  const thumbTip = lm[4]; // 拇指尖
  const indexTip = lm[8]; // 食指尖
  const wrist = lm[0]; // 手腕
  const palm = palmCenter(lm); // 掌心

  // 食指尖应收拢贴拳，不能大幅外伸（外伸且碰拇指更像比心）
  const indexReach = dist(indexTip, wrist); // 食指伸出长度
  if (indexReach > handSize * 1.15) return false; // 食指伸太远不像攥拳

  // 若拇食指尖贴近且交汇远离掌心，交由比心识别，这里不算攥拳
  const thumbIndexDist = dist(thumbTip, indexTip); // 拇食指尖距离
  const meet = { x: (thumbTip.x + indexTip.x) / 2, y: (thumbTip.y + indexTip.y) / 2 }; // 交汇点
  const tipsClose = thumbIndexDist < Math.max(0.05, handSize * 0.38); // 指尖是否贴近
  if (tipsClose && dist(meet, palm) >= handSize * 0.55) return false; // 更像比心

  return true; // 符合攥拳
}

// 思考：拇+食指伸出成 L/V 托下巴，其余收拢；填补与比心之间的识别死区
function isThinking(lm, f, thumbIndexDist, handSize) {
  if (f.middle || f.ring || f.pinky) return false; // 其余三指必须收拢（区别比耶）

  const thumbTip = lm[4]; // 拇指尖
  const indexTip = lm[8]; // 食指尖
  const indexMcp = lm[5]; // 食指根
  const wrist = lm[0]; // 手腕
  const palm = palmCenter(lm); // 掌心

  // 食指须明显伸出/朝上（点赞、攥拳时食指收拢，不能误判）
  const indexUpish = indexTip.y < indexMcp.y - 0.025; // 指尖高于根部（含斜向）
  if (!f.index && !indexUpish) return false; // 食指未伸出

  // 拇指须伸出：朝上/张开，或相对手掌够远（水平托下巴也能过）
  const thumbReach = dist(thumbTip, wrist); // 拇指伸出长度
  if (!(f.thumbOut || f.thumbUp || thumbReach > handSize * 0.6)) return false; // 拇指未伸出

  // 指尖分开成 L/V（区别比心）；阈值放宽，消除中间死区
  if (thumbIndexDist <= Math.max(0.045, handSize * 0.32)) return false; // 太近更像比心

  // 托下巴：掌心不要太低（放宽原 0.72，减少半身/远景漏检）
  if (palm.y > 0.82) return false; // 手过低

  // 食指尖须离开掌心（真正伸出，避免收拢手指误检）
  if (dist(indexTip, palm) < handSize * 0.42) return false; // 食指仍贴掌

  return true; // 符合思考
}

// 将线段从起点沿方向延长（用于模拟前臂穿过手掌后的交叉）
function extendPoint(from, toward, factor) {
  return {
    x: from.x + (toward.x - from.x) * factor, // 延长后的 x
    y: from.y + (toward.y - from.y) * factor, // 延长后的 y
  }; // 返回延长点
}

// 达咩姿势：单手五指并拢伸直（可略露掌心；斜向伸直也算）
function isDameFlatHand(lm) {
  const handSize = dist(lm[0], lm[9]) || 0.2; // 手掌尺度
  const tipIdx = [8, 12, 16, 20]; // 食中无名小指尖
  const mcpIdx = [5, 9, 13, 17]; // 对应指根
  let extended = 0; // 伸出指数量
  for (let i = 0; i < tipIdx.length; i += 1) {
    const tip = lm[tipIdx[i]]; // 指尖
    const mcp = lm[mcpIdx[i]]; // 指根
    const reach = dist(tip, lm[0]); // 指尖到腕
    const upish = tip.y < mcp.y - 0.012; // 指尖高于指根（含斜向）
    const longEnough = reach > handSize * 0.65; // 相对手掌足够长
    if (upish || longEnough) extended += 1; // 计为伸出
  }
  if (extended < 3) return false; // 至少三指伸出（五指并拢伸直）

  // 指尖横向跨度不能太大 → 并拢，不是五指张开
  const tipXs = tipIdx.map((i) => lm[i].x); // 四指尖 x
  const tipSpread = Math.max(...tipXs) - Math.min(...tipXs); // 横向跨度
  if (tipSpread > Math.max(0.22, handSize * 1.2)) return false; // 张开过大

  return true; // 符合并拢伸直掌
}

// 检测交叉手臂（达咩 X）：双手五指并拢伸直，胸前交叉成 X
function detectCrossedArms(multiHands) {
  if (!multiHands || multiHands.length < 2) return false; // 需要双手
  const a = multiHands[0]; // 第一只手
  const b = multiHands[1]; // 第二只手
  if (!a?.length || !b?.length) return false; // 无效关键点

  // 双手都必须是「五指并拢伸直」的平掌（攥拳抱臂不算）
  if (!isDameFlatHand(a) || !isDameFlatHand(b)) return false; // 非达咩手型

  const wa = a[0]; // 手腕 A
  const wb = b[0]; // 手腕 B
  const ma = a[9]; // 中指 MCP A
  const mb = b[9]; // 中指 MCP B
  const tipA = a[12]; // 中指尖 A
  const tipB = b[12]; // 中指尖 B
  const ca = palmCenter(a); // 掌心 A
  const cb = palmCenter(b); // 掌心 B

  // 高度接近，且在胸前区域
  if (Math.abs(wa.y - wb.y) > 0.38) return false; // 高低差过大
  if ((ca.y + cb.y) / 2 > 0.82) return false; // 过低不像胸前

  const wristDist = dist(wa, wb); // 手腕距离
  // 合十手腕极近；交叉成 X 时腕距更大一些
  if (wristDist < 0.12) return false; // 太近更像合十
  if (wristDist > 0.7) return false; // 过远

  // 双手大致朝斜上方（达咩双手上扬约 45°）
  const dirA = { x: tipA.x - wa.x, y: tipA.y - wa.y }; // A 腕→指尖
  const dirB = { x: tipB.x - wb.x, y: tipB.y - wb.y }; // B 腕→指尖
  if (dirA.y > 0.02 || dirB.y > 0.02) return false; // 指尖应高于或接近手腕上方

  // 形成 X：两手前臂/手指方向在水平分量上相反，或线段相交
  const oppositeX = dirA.x * dirB.x < 0; // 左右斜向相反
  const palmsCross = (wa.x - wb.x) * (ca.x - cb.x) < 0; // 腕与掌左右相反
  const tipsCross = (wa.x - wb.x) * (tipA.x - tipB.x) < 0; // 腕与指尖左右相反

  // 线段相交：腕→指尖 / 腕→MCP / 延长线
  const segHit =
    segmentsIntersect(wa, tipA, wb, tipB) || // 腕→中指尖
    segmentsIntersect(wa, ma, wb, mb) || // 腕→中指根
    segmentsIntersect(wa, extendPoint(wa, tipA, 1.4), wb, extendPoint(wb, tipB, 1.4)); // 延长相交

  if (segHit) return true; // 几何上已交叉成 X

  // 未直接相交时：必须有镜像交叉特征，且掌心/指尖不太远
  const closeEnough = dist(ca, cb) < 0.48 || dist(tipA, tipB) < 0.55; // 双手在胸前汇聚
  if ((oppositeX || palmsCross || tipsCross) && closeEnough && wristDist > 0.14) {
    return true; // 达咩式镜像交叉
  }

  return false; // 未匹配
}

// 单手是否大致「手指朝上」（合十时双手指尖向上）
function handFingersUp(lm) {
  const tips = [lm[8], lm[12], lm[16]]; // 食/中/无名指尖
  const mcps = [lm[5], lm[9], lm[13]]; // 对应指根
  let up = 0; // 朝上指数量
  for (let i = 0; i < tips.length; i += 1) {
    if (tips[i].y < mcps[i].y - 0.02) up += 1; // 指尖高于指根
  }
  return up >= 2; // 至少两指朝上
}

// 检测双手合十：掌心相对贴合、手腕靠近、手指朝上（区别于交叉手臂）
function detectPrayerHands(multiHands) {
  if (!multiHands || multiHands.length < 2) return false; // 需要双手
  const a = multiHands[0]; // 第一只手
  const b = multiHands[1]; // 第二只手
  if (!a?.length || !b?.length) return false; // 无效关键点

  const wa = a[0]; // 手腕 A
  const wb = b[0]; // 手腕 B
  const ca = palmCenter(a); // 掌心 A
  const cb = palmCenter(b); // 掌心 B
  const tipA = { x: (a[8].x + a[12].x) / 2, y: (a[8].y + a[12].y) / 2 }; // A 指尖中点
  const tipB = { x: (b[8].x + b[12].x) / 2, y: (b[8].y + b[12].y) / 2 }; // B 指尖中点

  // 双手高度接近（合十时左右手齐平）
  if (Math.abs(ca.y - cb.y) > 0.2) return false; // 掌心高低差过大
  if (Math.abs(wa.y - wb.y) > 0.22) return false; // 手腕高低差过大

  // 手腕必须很近（合十贴合；交叉手臂手腕通常明显分开）
  const wristDist = dist(wa, wb); // 手腕距离
  if (wristDist > 0.18) return false; // 手腕过远 → 更像交叉/其他
  if (Math.abs(wa.x - wb.x) > 0.16) return false; // 手腕横向也须靠近

  // 掌心贴近
  if (dist(ca, cb) > 0.18) return false; // 掌心过远

  // 手指大致朝上
  if (!handFingersUp(a) || !handFingersUp(b)) return false; // 双手指尖向上

  // 指尖也靠近（两掌对齐）
  if (dist(tipA, tipB) > 0.22) return false; // 指尖分太开

  // 排除交叉：腕与掌左右关系相反且腕距不算极近时，视为交叉而非合十
  const palmsCross = (wa.x - wb.x) * (ca.x - cb.x) < 0; // 腕与掌左右相反
  if (palmsCross && wristDist > 0.1) return false; // 交叉姿态排除

  // 合十通常在胸前/脸前，不要太低
  if ((ca.y + cb.y) / 2 > 0.82) return false; // 过低

  // 指尖应明显高于手腕（双手竖起合十）
  if (tipA.y > wa.y - 0.08 || tipB.y > wb.y - 0.08) return false; // 指尖不够朝上

  return true; // 符合双手合十
}

// 内置手势识别（可传入多只手）
export function detectBuiltinGesture(landmarks, multiHands = null) {
  const hands = multiHands || (landmarks ? [landmarks] : null); // 手列表

  // 双手合十（祝福）优先于交叉手臂，避免贴合双手被误判为交叉
  if (detectPrayerHands(hands)) {
    return BUILTIN_GESTURES.find((g) => g.id === "pray"); // 祝福
  }

  // 交叉手臂（双手胸前交叉）
  if (detectCrossedArms(hands)) {
    return BUILTIN_GESTURES.find((g) => g.id === "cross"); // 交叉手臂
  }

  if (!landmarks || landmarks.length < 21) return null; // 无效单手输入
  const f = fingerStates(landmarks); // 各指状态
  const thumbTip = landmarks[4]; // 拇指尖
  const indexTip = landmarks[8]; // 食指尖（OK / 比心成圈用）
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

  // 比心：拇、食指伸出且指尖贴近成心，其余收拢（优先于攥拳/点赞）
  if (isFingerHeart(landmarks, f, thumbIndexDist, handSize)) {
    return BUILTIN_GESTURES.find((g) => g.id === "heart"); // 比心
  }

  // 思考：拇食指成 V，其余收拢（优先于点赞）
  if (isThinking(landmarks, f, thumbIndexDist, handSize)) {
    return BUILTIN_GESTURES.find((g) => g.id === "think"); // 思考
  }

  // 点赞：只有拇指竖起
  if (f.thumbUp && !f.index && !f.middle && !f.ring && !f.pinky) {
    return BUILTIN_GESTURES.find((g) => g.id === "thumbs"); // 点赞
  }

  // 攥拳：五指全部收拢成拳（与比心已严格区分）
  if (isFist(landmarks, f, handSize)) {
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
  // 思考手势更快确认（1 帧），其余仍需连续稳定帧
  const need = gesture.id === "think" ? 1 : STABLE_FRAMES; // 所需稳定帧
  if (stableCount >= need) return gesture; // 确认
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
