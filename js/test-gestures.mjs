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
  // OK: tips form a circle, index not counted as extended
  if (fingerState.special === "ok") {
    lm[4] = pt(0.46, 0.50); // thumb tip
    lm[3] = pt(0.44, 0.52); // thumb ip
    lm[8] = pt(0.48, 0.50); // index tip near thumb
    lm[6] = pt(0.47, 0.48); // index pip ABOVE tip so finger is curled
    lm[7] = pt(0.47, 0.49); // index dip
    lm[5] = pt(0.46, 0.58); // index mcp
    lm[12] = pt(0.5, 0.68); // middle tip curled
    lm[10] = pt(0.5, 0.55); // middle pip
    lm[16] = pt(0.56, 0.68); // ring tip curled
    lm[14] = pt(0.56, 0.55); // ring pip
    lm[20] = pt(0.62, 0.68); // pinky tip curled
    lm[18] = pt(0.62, 0.55); // pinky pip
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

// Cases: names match image filenames
const cases = [
  { name: "ok", state: { special: "ok", thumb: "up", index: "down", middle: "down", ring: "down", pinky: "down" }, expect: "ok" }, // OK
  { name: "biye", state: { thumb: "down", index: "up", middle: "up", ring: "down", pinky: "down" }, expect: "peace" }, // peace
  { name: "dianzan", state: { thumb: "up", index: "down", middle: "down", ring: "down", pinky: "down" }, expect: "thumbs" }, // thumbs
  { name: "quan", state: { thumb: "down", index: "down", middle: "down", ring: "down", pinky: "down" }, expect: "fist" }, // fist
  { name: "cross", state: null, expect: "cross", multi: true }, // crossed arms
  { name: "6", state: { thumb: "up", index: "down", middle: "down", ring: "down", pinky: "up" }, expect: "six" }, // six
  { name: "cover", state: { thumb: "down", index: "up", middle: "down", ring: "down", pinky: "down", special: "cover" }, expect: "cover" }, // cover
];

let pass = 0; // pass count
let fail = 0; // fail count
console.log("\n=== gesture detect test ===\n");
console.log("| name | expect | got | result |");
console.log("|------|--------|-----|--------|");

cases.forEach((c) => {
  let result = null; // detect result
  if (c.multi) {
    const hands = mockCrossedArms(); // two hands
    result = detectBuiltinGesture(hands[0], hands); // cross
  } else {
    let state = { ...c.state }; // copy
    const lm = mockHand(state); // mock
    if (c.state.special === "cover") {
      // Raise whole hand so index tip is near face, only index extended
      lm[0] = pt(0.5, 0.55); // wrist higher
      lm[8] = pt(0.48, 0.30); // index tip near face
      lm[6] = pt(0.47, 0.40); // index pip
      lm[5] = pt(0.46, 0.48); // index mcp
    }
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
