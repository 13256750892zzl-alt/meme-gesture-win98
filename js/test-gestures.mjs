// Gesture recognition unit tests (Node)
import { detectBuiltinGesture, BUILTIN_GESTURES } from "./gestures.js";
import fs from "fs"; // filesystem
import path from "path"; // path utils
import { fileURLToPath } from "url"; // file URL helper

// Build a 3D landmark point
function pt(x, y, z = 0) {
  return { x, y, z }; // point
}

// Mock 21 hand landmarks from finger open/close state
function mockHand(fingerState) {
  const wrist = pt(0.5, 0.75); // wrist
  const lm = Array.from({ length: 21 }, () => ({ ...wrist })); // init
  lm[0] = wrist; // wrist landmark
  const chains = {
    thumb: [1, 2, 3, 4], // thumb chain
    index: [5, 6, 7, 8], // index chain
    middle: [9, 10, 11, 12], // middle chain
    ring: [13, 14, 15, 16], // ring chain
    pinky: [17, 18, 19, 20], // pinky chain
  }; // finger index map
  Object.entries(chains).forEach(([name, idxs]) => {
    const up = fingerState[name] === "up"; // finger extended?
    const mcpY = 0.62; // MCP y
    const pipY = up ? 0.48 : 0.55; // PIP y (isFingerUp reads idxs[1])
    const tipY = up ? 0.28 : 0.68; // tip y: curled tip below pip
    const baseX = name === "thumb" ? 0.38 : name === "index" ? 0.44 : name === "middle" ? 0.5 : name === "ring" ? 0.56 : name === "pinky" ? 0.62 : 0.5; // base x
    lm[idxs[0]] = pt(baseX, mcpY); // MCP
    lm[idxs[1]] = pt(baseX, pipY); // PIP
    lm[idxs[2]] = pt(baseX, up ? (pipY + tipY) / 2 : pipY + 0.04); // DIP
    lm[idxs[3]] = pt(baseX, tipY); // TIP
  });
  // Curled thumb stays near palm so fist != OK
  if (fingerState.thumb !== "up" && fingerState.special !== "ok") {
    lm[4] = pt(0.30, 0.72); // thumb tip tucked away from index
    lm[3] = pt(0.34, 0.66); // thumb ip
  }
  // OK: thumb+index circle, middle/ring/pinky raised
  if (fingerState.special === "ok") {
    lm[4] = pt(0.46, 0.48); // thumb tip
    lm[3] = pt(0.44, 0.52); // thumb ip
    lm[8] = pt(0.48, 0.48); // index tip near thumb (circle)
    lm[6] = pt(0.47, 0.46); // index pip above tip = curled
    lm[7] = pt(0.47, 0.47); // index dip
    lm[5] = pt(0.46, 0.58); // index mcp
    lm[12] = pt(0.5, 0.28); // middle tip up
    lm[10] = pt(0.5, 0.48); // middle pip
    lm[9] = pt(0.5, 0.62); // middle mcp
    lm[16] = pt(0.56, 0.28); // ring tip up
    lm[14] = pt(0.56, 0.48); // ring pip
    lm[13] = pt(0.56, 0.62); // ring mcp
    lm[20] = pt(0.62, 0.28); // pinky tip up
    lm[18] = pt(0.62, 0.48); // pinky pip
    lm[17] = pt(0.62, 0.62); // pinky mcp
  }
  return lm; // landmarks
}

// Mock two hands crossing at the chest
function mockCrossedArms() {
  const left = mockHand({ thumb: "up", index: "up", middle: "up", ring: "up", pinky: "up" }); // left open
  const right = mockHand({ thumb: "up", index: "up", middle: "up", ring: "up", pinky: "up" }); // right open
  left[0] = pt(0.62, 0.55); // left wrist on right side
  left[9] = pt(0.38, 0.48); // left palm on left side
  right[0] = pt(0.38, 0.58); // right wrist on left side
  right[9] = pt(0.62, 0.5); // right palm on right side
  return [left, right]; // both hands
}

// Mock folded arms: wrists apart, palms closer (no perfect segment cross)
function mockFoldedArms() {
  const left = mockHand({ thumb: "down", index: "down", middle: "down", ring: "down", pinky: "down" }); // 左拳
  const right = mockHand({ thumb: "down", index: "down", middle: "down", ring: "down", pinky: "down" }); // 右拳
  left[0] = pt(0.68, 0.52); // 左腕偏右
  left[5] = pt(0.48, 0.50); // 左食指根向内
  left[9] = pt(0.46, 0.49); // 左掌心靠中
  left[12] = pt(0.44, 0.48); // 左中指尖
  right[0] = pt(0.30, 0.54); // 右腕偏左
  right[5] = pt(0.50, 0.51); // 右食指根向内
  right[9] = pt(0.52, 0.50); // 右掌心靠中
  right[12] = pt(0.54, 0.49); // 右中指尖
  return [left, right]; // 向内折叠交叉
}

// Mock slightly uneven height cross (common real pose)
function mockUnevenCross() {
  const left = mockHand({ thumb: "up", index: "up", middle: "up", ring: "up", pinky: "up" }); // 左手
  const right = mockHand({ thumb: "up", index: "up", middle: "up", ring: "up", pinky: "up" }); // 右手
  left[0] = pt(0.66, 0.42); // 左腕较高偏右
  left[9] = pt(0.40, 0.50); // 左掌向左下
  left[12] = pt(0.36, 0.52); // 左指尖
  right[0] = pt(0.34, 0.62); // 右腕较低偏左
  right[9] = pt(0.58, 0.48); // 右掌向右上
  right[12] = pt(0.62, 0.46); // 右指尖
  return [left, right]; // 高低差交叉
}

// Mock finger-heart: thumb tip near index tip, other fingers curled
function mockFingerHeart() {
  const h = mockHand({ thumb: "up", index: "down", middle: "down", ring: "down", pinky: "down" }); // base curled
  h[4] = pt(0.46, 0.48); // thumb tip
  h[3] = pt(0.44, 0.52); // thumb ip
  h[8] = pt(0.48, 0.48); // index tip near thumb (heart)
  h[6] = pt(0.47, 0.46); // index pip above tip = bent
  h[7] = pt(0.47, 0.47); // index dip
  h[5] = pt(0.46, 0.58); // index mcp
  return h; // landmarks
}

// Mock fist with thumb wrapped near index knuckles (must NOT be heart)
function mockFistThumbWrap() {
  const h = mockHand({ thumb: "down", index: "down", middle: "down", ring: "down", pinky: "down" }); // all curled
  h[4] = pt(0.46, 0.64); // thumb tip on fist surface near index
  h[3] = pt(0.42, 0.66); // thumb ip
  h[8] = pt(0.45, 0.66); // index tip curled near thumb (close tips, but near palm)
  h[6] = pt(0.44, 0.58); // index pip
  h[7] = pt(0.44, 0.62); // index dip
  h[5] = pt(0.44, 0.62); // index mcp
  return h; // landmarks
}

// Mock thinking: thumb + index extended as V, others curled
function mockThinking() {
  const h = mockHand({ thumb: "up", index: "up", middle: "down", ring: "down", pinky: "down" }); // 食拇
  h[0] = pt(0.5, 0.70); // wrist near chin area
  h[4] = pt(0.36, 0.42); // thumb tip out
  h[3] = pt(0.40, 0.50); // thumb ip
  h[8] = pt(0.56, 0.28); // index tip up, apart from thumb
  h[6] = pt(0.54, 0.48); // index pip
  h[5] = pt(0.52, 0.60); // index mcp
  h[9] = pt(0.50, 0.58); // middle mcp for handSize
  return h; // landmarks
}

// Cases: names match image filenames
const cases = [
  { name: "ok", state: { special: "ok", thumb: "up", index: "down", middle: "up", ring: "up", pinky: "up" }, expect: "ok" }, // OK
  { name: "biye", state: { thumb: "down", index: "up", middle: "up", ring: "down", pinky: "down" }, expect: "peace" }, // peace
  { name: "dianzan", state: { thumb: "up", index: "down", middle: "down", ring: "down", pinky: "down" }, expect: "thumbs" }, // thumbs
  { name: "quan", state: { thumb: "down", index: "down", middle: "down", ring: "down", pinky: "down" }, expect: "fist" }, // fist
  { name: "quan-wrap", state: null, expect: "fist", multi: "fist-wrap" }, // fist with thumb on knuckles
  { name: "cross", state: null, expect: "cross", multi: "cross" }, // crossed arms
  { name: "cross-fold", state: null, expect: "cross", multi: "cross-fold" }, // folded arms
  { name: "cross-uneven", state: null, expect: "cross", multi: "cross-uneven" }, // uneven height cross
  { name: "6", state: { thumb: "up", index: "down", middle: "down", ring: "down", pinky: "up" }, expect: "six" }, // six
  { name: "heart", state: null, expect: "heart", multi: "heart" }, // finger heart
  { name: "think", state: null, expect: "think", multi: "think" }, // thinking
];

let pass = 0; // pass count
let fail = 0; // fail count
console.log("\n=== gesture detect test ===\n");
console.log("| name | expect | got | result |");
console.log("|------|--------|-----|--------|");

cases.forEach((c) => {
  let result = null; // detect result
  if (c.multi === "cross") {
    const hands = mockCrossedArms(); // two hands cross
    result = detectBuiltinGesture(hands[0], hands); // detect
  } else if (c.multi === "cross-fold") {
    const hands = mockFoldedArms(); // folded inward
    result = detectBuiltinGesture(hands[0], hands); // detect
  } else if (c.multi === "cross-uneven") {
    const hands = mockUnevenCross(); // uneven height
    result = detectBuiltinGesture(hands[0], hands); // detect
  } else if (c.multi === "heart") {
    result = detectBuiltinGesture(mockFingerHeart()); // finger heart
  } else if (c.multi === "fist-wrap") {
    result = detectBuiltinGesture(mockFistThumbWrap()); // fist thumb wrap ≠ heart
  } else if (c.multi === "think") {
    result = detectBuiltinGesture(mockThinking()); // thinking
  } else {
    const lm = mockHand({ ...c.state }); // mock single
    result = detectBuiltinGesture(lm); // single hand
  }
  const got = result?.id || "(null)"; // actual id
  const ok = got === c.expect; // pass?
  if (ok) pass += 1; // ++
  else fail += 1; // ++
  console.log(`| ${c.name} | ${c.expect} | ${got} | ${ok ? "PASS" : "FAIL"} |`);
});

const __dirname = path.dirname(fileURLToPath(import.meta.url)); // dir
const root = path.resolve(__dirname, ".."); // project root
console.log("\n=== meme asset check ===\n");
let imgPass = 0; // ok
let imgFail = 0; // missing
BUILTIN_GESTURES.forEach((g, i) => {
  const full = path.join(root, g.image); // full path
  const exists = fs.existsSync(full); // exists?
  if (exists) imgPass += 1; // ++
  else imgFail += 1; // ++
  console.log(`  ${i + 1}. ${g.name} -> ${g.image} [${exists ? "OK" : "MISSING"}]`);
});

console.log(`\ndetect: ${pass}/${cases.length} pass, ${fail} fail`);
console.log(`assets: ${imgPass}/${BUILTIN_GESTURES.length} found, ${imgFail} missing`);
process.exit(fail > 0 || imgFail > 0 ? 1 : 0); // exit code
