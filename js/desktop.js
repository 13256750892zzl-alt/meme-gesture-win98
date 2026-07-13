// 当前 z-index 计数器（窗口置顶用）
let zIndexCounter = 100; // 起始层级

// 已打开窗口 ID 集合
const openWindows = new Set(); // 跟踪打开状态

// 初始化桌面与窗口管理
export function initDesktop() {
  // 绑定桌面图标双击/单击
  document.querySelectorAll(".desktop-icon").forEach((icon) => {
    icon.addEventListener("click", () => {
      // 读取目标窗口 ID
      const winId = icon.dataset.window; // data-window 属性
      // 打开对应窗口
      openWindow(winId); // 显示窗口
    });
  });

  // 绑定开始菜单项
  document.querySelectorAll("#start-menu button").forEach((btn) => {
    btn.addEventListener("click", () => {
      // 打开窗口
      openWindow(btn.dataset.window); // 显示
      // 关闭开始菜单
      toggleStartMenu(false); // 隐藏菜单
    });
  });

  // 开始按钮切换菜单
  document.getElementById("btn-start").addEventListener("click", (e) => {
    e.stopPropagation(); // 阻止冒泡
    toggleStartMenu(); // 切换显示
  });

  // 点击桌面空白处关闭开始菜单
  document.getElementById("desktop").addEventListener("click", (e) => {
    // 若点击的是桌面本身
    if (e.target.id === "desktop" || e.target.classList.contains("desktop-icons")) {
      toggleStartMenu(false); // 关闭菜单
    }
  });

  // 为每个窗口绑定控制按钮
  document.querySelectorAll(".app-window").forEach((win) => {
    setupWindowControls(win); // 最小化/关闭/拖拽
  });

  // 启动时钟
  updateClock(); // 立即更新
  setInterval(updateClock, 1000); // 每秒刷新

  // Clippy 点击显示气泡
  document.getElementById("clippy").addEventListener("click", () => {
    const bubble = document.getElementById("clippy-bubble"); // 气泡元素
    bubble.classList.toggle("hidden"); // 切换显示
  });
}

// 打开指定窗口
export function openWindow(name) {
  // 构造窗口元素 ID
  const el = document.getElementById(`win-${name}`); // 窗口 DOM
  // 找不到则退出
  if (!el) return; // 无效 ID
  // 移除隐藏与最小化
  el.classList.remove("hidden", "minimized"); // 显示
  // 置顶激活
  activateWindow(el); // 聚焦
  // 记录为已打开
  openWindows.add(name); // 加入集合
  // 刷新任务栏
  refreshTaskbar(); // 更新按钮
  // 首次打开扫雷则初始化
  if (name === "mines" && !el.dataset.inited) {
    el.dataset.inited = "1"; // 标记已初始化
    import("./minesweeper.js").then(({ initMinesweeper }) => initMinesweeper()); // 动态加载
  }
}

// 关闭窗口
export function closeWindow(name) {
  // 获取窗口元素
  const el = document.getElementById(`win-${name}`); // DOM
  if (!el) return; // 不存在
  // 隐藏窗口
  el.classList.add("hidden"); // 关闭
  // 从打开集合移除
  openWindows.delete(name); // 删除记录
  // 刷新任务栏
  refreshTaskbar(); // 更新
}

// 最小化窗口
export function minimizeWindow(name) {
  // 获取窗口元素
  const el = document.getElementById(`win-${name}`); // DOM
  if (!el) return; // 不存在
  // 添加最小化类
  el.classList.add("minimized"); // 隐藏
  // 刷新任务栏
  refreshTaskbar(); // 更新
}

// 激活窗口（置顶）
function activateWindow(el) {
  // 移除其他窗口激活态
  document.querySelectorAll(".app-window.active").forEach((w) => w.classList.remove("active")); // 取消
  // 当前窗口激活
  el.classList.add("active"); // 标记
  // 提升 z-index
  zIndexCounter += 1; // 递增
  el.style.zIndex = String(zIndexCounter); // 应用
}

// 设置窗口控制与拖拽
function setupWindowControls(win) {
  // 标题栏元素
  const titleBar = win.querySelector(".title-bar"); // 拖拽区域
  // 关闭按钮
  win.querySelector(".btn-close")?.addEventListener("click", (e) => {
    e.stopPropagation(); // 阻止冒泡
    const name = win.id.replace("win-", ""); // 窗口名
    closeWindow(name); // 关闭
  });
  // 最小化按钮
  win.querySelector(".btn-minimize")?.addEventListener("click", (e) => {
    e.stopPropagation(); // 阻止冒泡
    const name = win.id.replace("win-", ""); // 窗口名
    minimizeWindow(name); // 最小化
  });
  // 最大化按钮（简化为固定尺寸切换）
  win.querySelector(".btn-maximize")?.addEventListener("click", (e) => {
    e.stopPropagation(); // 阻止冒泡
    // 切换宽度
    if (win.style.width === "90vw") {
      win.style.width = ""; // 恢复默认
      win.style.height = ""; // 恢复默认
    } else {
      win.style.width = "90vw"; // 放大
      win.style.height = "80vh"; // 放大
    }
  });
  // 点击窗口激活
  win.addEventListener("mousedown", () => activateWindow(win)); // 置顶
  // 拖拽逻辑
  let dragging = false; // 拖拽标志
  let offsetX = 0; // X 偏移
  let offsetY = 0; // Y 偏移
  titleBar.addEventListener("mousedown", (e) => {
    // 忽略按钮点击
    if (e.target.closest(".title-bar-controls")) return; // 跳过
    dragging = true; // 开始拖拽
    offsetX = e.clientX - win.offsetLeft; // 计算 X 偏移
    offsetY = e.clientY - win.offsetTop; // 计算 Y 偏移
    activateWindow(win); // 激活
  });
  document.addEventListener("mousemove", (e) => {
    // 未拖拽则跳过
    if (!dragging) return; // 退出
    // 更新位置
    win.style.left = `${Math.max(0, e.clientX - offsetX)}px`; // 新 X
    win.style.top = `${Math.max(0, e.clientY - offsetY)}px`; // 新 Y
  });
  document.addEventListener("mouseup", () => {
    dragging = false; // 结束拖拽
  });
}

// 切换开始菜单显示
function toggleStartMenu(force) {
  // 获取菜单元素
  const menu = document.getElementById("start-menu"); // DOM
  // 强制显示/隐藏
  if (force === true) {
    menu.classList.remove("hidden"); // 显示
    return; // 完成
  }
  if (force === false) {
    menu.classList.add("hidden"); // 隐藏
    return; // 完成
  }
  // 否则切换
  menu.classList.toggle("hidden"); // 切换
}

// 刷新任务栏应用按钮
function refreshTaskbar() {
  // 任务栏容器
  const container = document.getElementById("taskbar-apps"); // DOM
  container.innerHTML = ""; // 清空
  // 遍历已打开窗口
  openWindows.forEach((name) => {
    // 获取窗口元素
    const win = document.getElementById(`win-${name}`); // DOM
    if (!win) return; // 跳过
    // 创建任务栏按钮
    const btn = document.createElement("button"); // 按钮
    btn.className = "taskbar-app"; // 样式类
    btn.textContent = win.dataset.title || name; // 显示标题
    // 若窗口未最小化则标记激活
    if (!win.classList.contains("minimized") && !win.classList.contains("hidden")) {
      btn.classList.add("active"); // 按下态
    }
    // 点击切换窗口
    btn.addEventListener("click", () => {
      // 若已最小化或隐藏则恢复
      if (win.classList.contains("minimized") || win.classList.contains("hidden")) {
        win.classList.remove("minimized", "hidden"); // 恢复
        activateWindow(win); // 激活
      } else {
        minimizeWindow(name); // 再次点击最小化
      }
      refreshTaskbar(); // 刷新
    });
    container.appendChild(btn); // 添加到任务栏
  });
}

// 更新系统时钟
function updateClock() {
  // 当前时间
  const now = new Date(); // 日期对象
  // 格式化为 HH:MM
  const hh = String(now.getHours()).padStart(2, "0"); // 小时
  const mm = String(now.getMinutes()).padStart(2, "0"); // 分钟
  // 写入 DOM
  document.getElementById("clock").textContent = `${hh}:${mm}`; // 显示
}

// 显示 Clippy 提示
export function showClippyTip(text) {
  // 获取气泡元素
  const bubble = document.getElementById("clippy-bubble"); // DOM
  bubble.textContent = text; // 设置文字
  bubble.classList.remove("hidden"); // 显示
  // 5 秒后自动隐藏
  setTimeout(() => bubble.classList.add("hidden"), 5000); // 隐藏
}

// 导出 openWindows 供调试
export { openWindows }; // 导出集合
