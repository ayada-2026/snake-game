const GRID_SIZE = 14;
const TICK_MS = 150;

const DIRECTIONS = Object.freeze({
  up: { row: -1, col: 0 },
  down: { row: 1, col: 0 },
  left: { row: 0, col: -1 },
  right: { row: 0, col: 1 }
});

function clonePosition(position) {
  return { row: position.row, col: position.col };
}

function positionsMatch(first, second) {
  return first.row === second.row && first.col === second.col;
}

function isOppositeDirection(currentDirection, nextDirection) {
  return (
    DIRECTIONS[currentDirection].row + DIRECTIONS[nextDirection].row === 0 &&
    DIRECTIONS[currentDirection].col + DIRECTIONS[nextDirection].col === 0
  );
}

function placeFood({ rows, cols, snake, rng = Math.random }) {
  const occupied = new Set(snake.map((segment) => `${segment.row}:${segment.col}`));
  const emptyCells = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const key = `${row}:${col}`;

      if (!occupied.has(key)) {
        emptyCells.push({ row, col });
      }
    }
  }

  if (emptyCells.length === 0) {
    return null;
  }

  const index = Math.floor(rng() * emptyCells.length);
  return emptyCells[index];
}

function createInitialState({ rows = GRID_SIZE, cols = GRID_SIZE, rng = Math.random } = {}) {
  const centerRow = Math.floor(rows / 2);
  const centerCol = Math.floor(cols / 2);
  const snake = [
    { row: centerRow, col: centerCol },
    { row: centerRow, col: centerCol - 1 },
    { row: centerRow, col: centerCol - 2 }
  ];
  const direction = "right";

  return {
    rows,
    cols,
    snake,
    direction,
    pendingDirection: direction,
    food: placeFood({ rows, cols, snake, rng }),
    score: 0,
    status: "running"
  };
}

function queueDirectionChange(state, nextDirection) {
  if (state.status !== "running" || !DIRECTIONS[nextDirection]) {
    return state;
  }

  if (state.pendingDirection !== state.direction) {
    return state;
  }

  if (state.snake.length > 1 && isOppositeDirection(state.direction, nextDirection)) {
    return state;
  }

  return {
    ...state,
    pendingDirection: nextDirection
  };
}

function stepGame(state, rng = Math.random) {
  if (state.status !== "running") {
    return state;
  }

  const direction = state.pendingDirection;
  const movement = DIRECTIONS[direction];
  const currentHead = state.snake[0];
  const nextHead = {
    row: currentHead.row + movement.row,
    col: currentHead.col + movement.col
  };

  const outOfBounds =
    nextHead.row < 0 ||
    nextHead.row >= state.rows ||
    nextHead.col < 0 ||
    nextHead.col >= state.cols;

  const willEat = state.food ? positionsMatch(nextHead, state.food) : false;
  const collisionBody = willEat ? state.snake : state.snake.slice(0, -1);
  const hitsSelf = collisionBody.some((segment) => positionsMatch(segment, nextHead));

  if (outOfBounds || hitsSelf) {
    return {
      ...state,
      direction,
      pendingDirection: direction,
      status: "game-over"
    };
  }

  const nextSnake = [nextHead, ...state.snake.map(clonePosition)];

  if (!willEat) {
    nextSnake.pop();
  }

  const nextFood = willEat
    ? placeFood({ rows: state.rows, cols: state.cols, snake: nextSnake, rng })
    : state.food;

  return {
    ...state,
    snake: nextSnake,
    direction,
    pendingDirection: direction,
    food: nextFood,
    score: willEat ? state.score + 1 : state.score,
    status: nextFood ? "running" : "won"
  };
}

function initializeSnakeGame() {
  const boardElement = document.getElementById("gameBoard");
  const boardFrame = document.getElementById("boardFrame");
  const scoreText = document.getElementById("scoreText");
  const lengthText = document.getElementById("lengthText");
  const statusText = document.getElementById("statusText");
  const pauseButton = document.getElementById("pauseButton");
  const restartButton = document.getElementById("restartButton");
  const overlay = document.getElementById("overlay");
  const overlayEyebrow = document.getElementById("overlayEyebrow");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayCopy = document.getElementById("overlayCopy");
  const overlayRestartButton = document.getElementById("overlayRestartButton");
  const directionButtons = Array.from(document.querySelectorAll("[data-direction]"));

  if (
    !boardElement ||
    !boardFrame ||
    !scoreText ||
    !lengthText ||
    !statusText ||
    !pauseButton ||
    !restartButton ||
    !overlay ||
    !overlayEyebrow ||
    !overlayTitle ||
    !overlayCopy ||
    !overlayRestartButton
  ) {
    return;
  }

  let state = createInitialState();
  let isPaused = false;
  let timerId = null;
  const cells = [];

  function buildBoard() {
    boardElement.style.setProperty("--grid-size", String(state.rows));
    boardElement.innerHTML = "";
    cells.length = 0;

    for (let index = 0; index < state.rows * state.cols; index += 1) {
      const cell = document.createElement("div");
      cell.className = "cell";
      boardElement.appendChild(cell);
      cells.push(cell);
    }
  }

  function getCellIndex(row, col) {
    return row * state.cols + col;
  }

  function getStatusMessage() {
    if (state.status === "won") {
      return "클리어";
    }

    if (state.status === "game-over") {
      return "게임 종료";
    }

    if (isPaused) {
      return "일시정지";
    }

    return "진행 중";
  }

  function renderOverlay() {
    const isVisible = state.status === "game-over" || state.status === "won";

    overlay.classList.toggle("hidden", !isVisible);

    if (!isVisible) {
      return;
    }

    if (state.status === "won") {
      overlayEyebrow.textContent = "보드 클리어";
      overlayTitle.textContent = "빈 칸 없이 모두 채웠어요";
      overlayCopy.textContent = `최종 점수 ${state.score}점, 길이 ${state.snake.length}칸입니다.`;
      return;
    }

    overlayEyebrow.textContent = "게임 종료";
    overlayTitle.textContent = "벽이나 몸에 닿았습니다";
    overlayCopy.textContent = `최종 점수 ${state.score}점, 길이 ${state.snake.length}칸에서 멈췄습니다.`;
  }

  function render() {
    cells.forEach((cell) => {
      cell.className = "cell";
    });

    if (state.food) {
      cells[getCellIndex(state.food.row, state.food.col)].classList.add("cell-food");
    }

    state.snake.forEach((segment, index) => {
      const cell = cells[getCellIndex(segment.row, segment.col)];

      if (cell) {
        cell.classList.add(index === 0 ? "cell-head" : "cell-snake");
      }
    });

    scoreText.textContent = String(state.score);
    lengthText.textContent = String(state.snake.length);
    statusText.textContent = getStatusMessage();
    pauseButton.textContent = isPaused ? "계속" : "일시정지";
    pauseButton.disabled = state.status !== "running" && !isPaused;
    boardFrame.classList.toggle("is-paused", isPaused);

    renderOverlay();
  }

  function stopLoop() {
    if (!timerId) {
      return;
    }

    window.clearInterval(timerId);
    timerId = null;
  }

  function tick() {
    state = stepGame(state, Math.random);
    render();

    if (state.status !== "running") {
      stopLoop();
    }
  }

  function startLoop() {
    stopLoop();

    if (isPaused || state.status !== "running") {
      return;
    }

    timerId = window.setInterval(tick, TICK_MS);
  }

  function restartGame() {
    state = createInitialState();
    isPaused = false;
    buildBoard();
    render();
    startLoop();
  }

  function togglePause() {
    if (state.status !== "running") {
      return;
    }

    isPaused = !isPaused;
    render();

    if (isPaused) {
      stopLoop();
      return;
    }

    startLoop();
  }

  function handleDirectionInput(direction) {
    if (state.status !== "running" || isPaused) {
      return;
    }

    state = queueDirectionChange(state, direction);
  }

  function handleKeyDown(event) {
    const directionByKey = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
      w: "up",
      W: "up",
      a: "left",
      A: "left",
      s: "down",
      S: "down",
      d: "right",
      D: "right"
    };

    if (event.key === " " || event.key === "Spacebar" || event.key === "p" || event.key === "P") {
      event.preventDefault();
      togglePause();
      return;
    }

    const direction = directionByKey[event.key];

    if (!direction) {
      return;
    }

    event.preventDefault();
    handleDirectionInput(direction);
  }

  pauseButton.addEventListener("click", togglePause);
  restartButton.addEventListener("click", restartGame);
  overlayRestartButton.addEventListener("click", restartGame);
  directionButtons.forEach((button) => {
    button.addEventListener("click", () => {
      handleDirectionInput(button.dataset.direction);
    });
  });
  window.addEventListener("keydown", handleKeyDown);

  buildBoard();
  render();
  startLoop();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeSnakeGame, { once: true });
} else {
  initializeSnakeGame();
}
