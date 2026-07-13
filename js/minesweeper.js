// 棋盘行数
const ROWS = 9; // 9 行

// 棋盘列数
const COLS = 9; // 9 列

// 地雷总数
const MINES = 10; // 10 颗雷

// 棋盘数据（二维数组）
let board = []; // 存储格子状态

// 游戏是否结束
let gameOver = false; // 结束标志

// 初始化扫雷游戏
export function initMinesweeper() {
  // 获取容器
  const container = document.getElementById("minesweeper"); // DOM
  // 重置状态
  gameOver = false; // 新游戏
  board = createBoard(); // 创建棋盘
  // 清空并渲染
  container.innerHTML = ""; // 清空
  renderBoard(container); // 绘制
  // 更新状态文字
  updateStatus(); // 显示雷数
}

// 创建棋盘数据
function createBoard() {
  // 初始化空棋盘
  const cells = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({
      mine: false, // 是否有雷
      revealed: false, // 是否翻开
      flagged: false, // 是否标记
      count: 0, // 周围雷数
    }))
  ); // 二维数组
  // 随机布雷
  let placed = 0; // 已放置雷数
  while (placed < MINES) {
    // 随机坐标
    const r = Math.floor(Math.random() * ROWS); // 行
    const c = Math.floor(Math.random() * COLS); // 列
    // 若该格无雷则放置
    if (!cells[r][c].mine) {
      cells[r][c].mine = true; // 布雷
      placed += 1; // 计数
    }
  }
  // 计算每格周围雷数
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      if (cells[r][c].mine) continue; // 雷格跳过
      cells[r][c].count = countAdjacentMines(cells, r, c); // 统计
    }
  }
  // 返回棋盘
  return cells; // 完成
}

// 统计周围八格雷数
function countAdjacentMines(cells, row, col) {
  // 累加计数
  let count = 0; // 初始 0
  // 遍历周围 8 格
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue; // 跳过自身
      const nr = row + dr; // 新行
      const nc = col + dc; // 新列
      // 边界检查
      if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && cells[nr][nc].mine) {
        count += 1; // 累加
      }
    }
  }
  return count; // 返回
}

// 渲染棋盘到 DOM
function renderBoard(container) {
  // 遍历每个格子
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      // 创建按钮
      const btn = document.createElement("button"); // 格子按钮
      btn.className = "mine-cell"; // 样式
      btn.dataset.row = String(r); // 行索引
      btn.dataset.col = String(c); // 列索引
      // 左键翻开
      btn.addEventListener("click", () => revealCell(r, c, container)); // 翻开
      // 右键标记
      btn.addEventListener("contextmenu", (e) => {
        e.preventDefault(); // 阻止菜单
        toggleFlag(r, c, container); // 标记
      });
      container.appendChild(btn); // 添加
    }
  }
}

// 翻开格子
function revealCell(row, col, container) {
  // 游戏结束则忽略
  if (gameOver) return; // 退出
  // 获取格子数据
  const cell = board[row][col]; // 当前格
  // 已翻开或已标记则忽略
  if (cell.revealed || cell.flagged) return; // 跳过
  // 标记为已翻开
  cell.revealed = true; // 翻开
  // 若踩雷则游戏结束
  if (cell.mine) {
    gameOver = true; // 结束
    revealAllMines(container); // 显示所有雷
    document.getElementById("mines-status").textContent = "💥 踩雷了！点击扫雷图标重新开始"; // 提示
    return; // 退出
  }
  // 若为 0 则递归翻开周围
  if (cell.count === 0) floodReveal(row, col); // 泛洪
  // 刷新显示
  refreshCells(container); // 更新 DOM
  // 检查胜利
  checkWin(); // 判定
}

// 泛洪翻开空白区域
function floodReveal(row, col) {
  // BFS 队列
  const queue = [[row, col]]; // 起始格
  // 循环处理
  while (queue.length) {
    const [r, c] = queue.shift(); // 出队
    // 遍历周围 8 格
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        const nr = r + dr; // 新行
        const nc = c + dc; // 新列
        // 边界与状态检查
        if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue; // 越界
        const neighbor = board[nr][nc]; // 邻居格
        if (neighbor.revealed || neighbor.mine || neighbor.flagged) continue; // 跳过
        neighbor.revealed = true; // 翻开
        // 若也为 0 则继续扩展
        if (neighbor.count === 0) queue.push([nr, nc]); // 入队
      }
    }
  }
}

// 切换标记状态
function toggleFlag(row, col, container) {
  // 游戏结束则忽略
  if (gameOver) return; // 退出
  const cell = board[row][col]; // 当前格
  if (cell.revealed) return; // 已翻开不能标记
  cell.flagged = !cell.flagged; // 切换
  refreshCells(container); // 更新
  updateStatus(); // 更新雷数
}

// 刷新所有格子显示
function refreshCells(container) {
  // 遍历按钮
  container.querySelectorAll(".mine-cell").forEach((btn) => {
    const r = Number(btn.dataset.row); // 行
    const c = Number(btn.dataset.col); // 列
    const cell = board[r][c]; // 数据
    // 重置样式
    btn.className = "mine-cell"; // 基础类
    btn.textContent = ""; // 清空文字
    // 已翻开
    if (cell.revealed) {
      btn.classList.add("revealed"); // 样式
      if (cell.mine) {
        btn.textContent = "💣"; // 显示雷
      } else if (cell.count > 0) {
        btn.textContent = String(cell.count); // 显示数字
        btn.style.color = numberColor(cell.count); // 数字颜色
      }
    } else if (cell.flagged) {
      btn.classList.add("flagged"); // 标记样式
      btn.textContent = "🚩"; // 旗帜
    }
  });
}

// 数字颜色映射
function numberColor(n) {
  const colors = ["", "#0000ff", "#008000", "#ff0000", "#000080", "#800000", "#008080", "#000000", "#808080"]; // 1-8
  return colors[n] || "#000"; // 默认黑
}

// 踩雷后显示所有雷
function revealAllMines(container) {
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      if (board[r][c].mine) board[r][c].revealed = true; // 翻开雷格
    }
  }
  refreshCells(container); // 更新
}

// 检查是否胜利
function checkWin() {
  // 统计非雷已翻开数
  let revealedSafe = 0; // 计数
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      if (!board[r][c].mine && board[r][c].revealed) revealedSafe += 1; // 累加
    }
  }
  // 全部非雷格翻开则胜利
  if (revealedSafe === ROWS * COLS - MINES) {
    gameOver = true; // 结束
    document.getElementById("mines-status").textContent = "🎉 恭喜通关！"; // 提示
  }
}

// 更新剩余雷数显示
function updateStatus() {
  // 统计标记数
  let flags = 0; // 计数
  board.forEach((row) => row.forEach((cell) => { if (cell.flagged) flags += 1; })); // 遍历
  document.getElementById("mines-status").textContent = `剩余雷数: ${Math.max(0, MINES - flags)}`; // 显示
}
