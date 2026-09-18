"use strict";

const LEVELS = [
  {
    name: "Разминка",
    map: [
      " #####",
      " #   #",
      " #.$ #",
      " # @ #",
      " #####"
    ]
  },
  {
    name: "Коридор",
    map: [
      " ######",
      " #    #",
      " # $$ #",
      " # .. #",
      " #  @ #",
      " ######"
    ]
  },
  {
    name: "Поворот",
    map: [
      " #######",
      " #  .  #",
      " #  $  #",
      " # $ . #",
      " #  @  #",
      " #######"
    ]
  },
  {
    name: "Погрузка",
    map: [
      "  #####",
      "###   #",
      "#. $  #",
      "#  $  #",
      "# .@###",
      "#####"
    ]
  },
  {
    name: "Финальный рейс",
    map: [
      " #######",
      " #  .  #",
      " #  .  #",
      " # $$  #",
      " #  @  #",
      " #     #",
      " #######"
    ]
  },
  {
    name: "Три места",
    map: [
      "########",
      "#   .  #",
      "# # .# #",
      "# $ $  #",
      "#  #   #",
      "# @    #",
      "########"
    ]
  },
  {
    name: "Два крыла",
    map: [
      "########",
      "# .  . #",
      "#   #  #",
      "#  $$  #",
      "#      #",
      "# @    #",
      "########"
    ]
  },
  {
    name: "Южный док",
    map: [
      "#########",
      "# . . . #",
      "#  # #  #",
      "# $ $ $ #",
      "#  # #  #",
      "#   @   #",
      "#########"
    ]
  },
  {
    name: "Шахматный зал",
    map: [
      "#########",
      "# . # . #",
      "#   .   #",
      "# $$#$  #",
      "#       #",
      "#   @   #",
      "#########"
    ]
  },
  {
    name: "Большая смена",
    map: [
      "##########",
      "# . . .  #",
      "#   #  . #",
      "# $$# $$ #",
      "#        #",
      "#  ##    #",
      "#    @   #",
      "##########"
    ]
  }
];

const board = document.querySelector("#board");
const levelList = document.querySelector("#level-list");
const randomLevelButton = document.querySelector("#random-level-button");
const levelValue = document.querySelector("#level-value");
const movesValue = document.querySelector("#moves-value");
const boxesValue = document.querySelector("#boxes-value");
const undoButton = document.querySelector("#undo-button");
const restartButton = document.querySelector("#restart-button");
const soundButton = document.querySelector("#sound-button");
const winDialog = document.querySelector("#win-dialog");
const winSummary = document.querySelector("#win-summary");
const nextButton = document.querySelector("#next-button");
const replayButton = document.querySelector("#replay-button");

let currentLevel = 0;
let randomMode = false;
let randomInitialState = null;
let state = null;
let history = [];
let moves = 0;
let unlocked = Math.min(Number(localStorage.getItem("sokoban-unlocked")) || 1, LEVELS.length);
let completed = JSON.parse(localStorage.getItem("sokoban-completed") || "[]");
let soundEnabled = true;
let audioContext = null;

function key(x, y) { return `${x},${y}`; }

function parseRows(rows) {
  const width = Math.max(...rows.map(row => row.length));
  const walls = new Set();
  const floors = new Set();
  const goals = new Set();
  const boxes = new Set();
  let player = { x: 0, y: 0 };

  rows.forEach((row, y) => {
    const firstWall = row.indexOf("#");
    const lastWall = row.lastIndexOf("#");
    for (let x = 0; x < width; x += 1) {
      const cell = row[x] || " ";
      if (cell === "#") walls.add(key(x, y));
      if (".@$*+".includes(cell) || (cell === " " && x > firstWall && x < lastWall)) floors.add(key(x, y));
      if (".*+".includes(cell)) goals.add(key(x, y));
      if ("$*".includes(cell)) boxes.add(key(x, y));
      if ("@+".includes(cell)) player = { x, y };
    }
  });

  return { width, height: rows.length, walls, floors, goals, boxes, player };
}

function loadLevel(index) {
  currentLevel = index;
  randomMode = false;
  state = parseRows(LEVELS[index].map);
  history = [];
  moves = 0;
  document.querySelector("#hint").textContent = "Доставьте все ящики на отмеченные места";
  render();
}

function cloneState(source) {
  return {
    ...source,
    walls: new Set(source.walls),
    floors: new Set(source.floors),
    goals: new Set(source.goals),
    boxes: new Set(source.boxes),
    player: { ...source.player }
  };
}

function shuffled(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function reachableFrom(start, boxes, floors) {
  const visited = new Set([key(start.x, start.y)]);
  const queue = [start];
  const steps = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    steps.forEach(([dx, dy]) => {
      const position = { x: current.x + dx, y: current.y + dy };
      const positionKey = key(position.x, position.y);
      if (floors.has(positionKey) && !boxes.has(positionKey) && !visited.has(positionKey)) {
        visited.add(positionKey);
        queue.push(position);
      }
    });
  }
  return visited;
}

function buildRandomState() {
  const width = 8;
  const height = 8;
  const floors = new Set();
  const walls = new Set();
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      (x === 0 || y === 0 || x === width - 1 || y === height - 1 ? walls : floors).add(key(x, y));
    }
  }

  const candidates = [];
  for (let y = 2; y <= height - 3; y += 1) {
    for (let x = 2; x <= width - 3; x += 1) candidates.push({ x, y });
  }
  const goalsArray = shuffled(candidates).slice(0, 3);
  const goals = new Set(goalsArray.map(position => key(position.x, position.y)));
  const boxes = new Set(goals);
  const freeCells = [...floors].filter(position => !boxes.has(position));
  const [playerX, playerY] = shuffled(freeCells)[0].split(",").map(Number);
  let player = { x: playerX, y: playerY };
  const directionsList = [[0, -1], [0, 1], [-1, 0], [1, 0]];

  for (let pull = 0; pull < 45; pull += 1) {
    const reachable = reachableFrom(player, boxes, floors);
    const options = [];
    boxes.forEach(boxPosition => {
      const [boxX, boxY] = boxPosition.split(",").map(Number);
      directionsList.forEach(([dx, dy]) => {
        const stance = key(boxX - dx, boxY - dy);
        const destination = key(boxX - 2 * dx, boxY - 2 * dy);
        if (reachable.has(stance) && floors.has(destination) && !boxes.has(destination)) {
          options.push({ boxPosition, boxX, boxY, dx, dy, destination });
        }
      });
    });
    if (!options.length) break;
    const choice = options[Math.floor(Math.random() * options.length)];
    boxes.delete(choice.boxPosition);
    boxes.add(key(choice.boxX - choice.dx, choice.boxY - choice.dy));
    player = { x: choice.boxX - 2 * choice.dx, y: choice.boxY - 2 * choice.dy };
  }

  return { width, height, walls, floors, goals, boxes, player };
}

function loadRandomLevel() {
  let generated = null;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    generated = buildRandomState();
    if (![...generated.boxes].every(box => generated.goals.has(box))) break;
  }
  randomMode = true;
  randomInitialState = cloneState(generated);
  state = generated;
  history = [];
  moves = 0;
  document.querySelector("#hint").textContent = "Случайная решаемая расстановка";
  render();
}

function restartLevel() {
  if (randomMode) {
    state = cloneState(randomInitialState);
    history = [];
    moves = 0;
    render();
  } else {
    loadLevel(currentLevel);
  }
}

function snapshot() {
  return { player: { ...state.player }, boxes: new Set(state.boxes), moves };
}

function move(dx, dy) {
  if (winDialog.open) return;
  const target = { x: state.player.x + dx, y: state.player.y + dy };
  const targetKey = key(target.x, target.y);
  if (state.walls.has(targetKey) || !state.floors.has(targetKey)) {
    playTone(100, 0.035);
    return;
  }

  if (state.boxes.has(targetKey)) {
    const beyond = { x: target.x + dx, y: target.y + dy };
    const beyondKey = key(beyond.x, beyond.y);
    if (state.walls.has(beyondKey) || state.boxes.has(beyondKey) || !state.floors.has(beyondKey)) {
      playTone(100, 0.035);
      return;
    }
    history.push(snapshot());
    state.boxes.delete(targetKey);
    state.boxes.add(beyondKey);
    playTone(210, 0.06);
  } else {
    history.push(snapshot());
    playTone(150, 0.025);
  }

  state.player = target;
  moves += 1;
  render();
  if (isComplete()) setTimeout(showWin, 180);
}

function undo() {
  const previous = history.pop();
  if (!previous) return;
  state.player = previous.player;
  state.boxes = previous.boxes;
  moves = previous.moves;
  playTone(130, 0.04);
  render();
}

function isComplete() {
  return [...state.boxes].every(box => state.goals.has(box));
}

function render() {
  board.replaceChildren();
  board.style.setProperty("--cols", state.width);
  board.style.setProperty("--rows", state.height);

  for (let y = 0; y < state.height; y += 1) {
    for (let x = 0; x < state.width; x += 1) {
      const position = key(x, y);
      const tile = document.createElement("div");
      tile.className = "tile";
      if (state.walls.has(position)) tile.classList.add("wall");
      else if (state.floors.has(position)) tile.classList.add(state.goals.has(position) ? "goal" : "floor");

      if (state.boxes.has(position)) {
        const box = document.createElement("span");
        box.className = `box${state.goals.has(position) ? " on-goal" : ""}`;
        tile.append(box);
      }
      if (state.player.x === x && state.player.y === y) {
        const player = document.createElement("span");
        player.className = "player";
        tile.append(player);
      }
      board.append(tile);
    }
  }

  const placedBoxes = [...state.boxes].filter(box => state.goals.has(box)).length;
  levelValue.textContent = randomMode ? "Случайный" : `${currentLevel + 1} / ${LEVELS.length}`;
  movesValue.textContent = moves;
  boxesValue.textContent = `${placedBoxes} / ${state.boxes.size}`;
  undoButton.disabled = history.length === 0;
  renderLevelList();
}

function renderLevelList() {
  levelList.replaceChildren();
  LEVELS.forEach((level, index) => {
    const locked = index + 1 > unlocked;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `level-button${!randomMode && index === currentLevel ? " active" : ""}${locked ? " locked" : ""}`;
    button.disabled = locked;
    button.innerHTML = `<span class="level-number">${String(index + 1).padStart(2, "0")}</span><span class="level-name">${level.name}</span><span class="level-status">${locked ? "&#9679;" : completed.includes(index) ? "&#10003;" : ""}</span>`;
    button.addEventListener("click", () => loadLevel(index));
    levelList.append(button);
  });
  randomLevelButton?.classList.toggle("active", randomMode);
}

function showWin() {
  if (!randomMode) {
    if (!completed.includes(currentLevel)) completed.push(currentLevel);
    unlocked = Math.min(Math.max(unlocked, currentLevel + 2), LEVELS.length);
    localStorage.setItem("sokoban-unlocked", unlocked);
    localStorage.setItem("sokoban-completed", JSON.stringify(completed));
  }
  winSummary.textContent = `Все ящики на местах за ${moves} ${moveWord(moves)}.`;
  nextButton.innerHTML = randomMode
    ? "Новый случайный сектор <span>&#9851;</span>"
    : currentLevel === LEVELS.length - 1 ? "Начать сначала <span>&#8635;</span>" : "Следующий уровень <span>&rarr;</span>";
  playVictory();
  winDialog.showModal();
}

function moveWord(value) {
  const lastTwo = value % 100;
  if (lastTwo >= 11 && lastTwo <= 14) return "ходов";
  if (value % 10 === 1) return "ход";
  if (value % 10 >= 2 && value % 10 <= 4) return "хода";
  return "ходов";
}

function playTone(frequency, duration) {
  if (!soundEnabled) return;
  audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = "triangle";
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.035, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration);
}

function playVictory() {
  [330, 440, 554].forEach((tone, index) => setTimeout(() => playTone(tone, 0.18), index * 110));
}

const directions = {
  ArrowUp: [0, -1], w: [0, -1], W: [0, -1],
  ArrowDown: [0, 1], s: [0, 1], S: [0, 1],
  ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0],
  ArrowRight: [1, 0], d: [1, 0], D: [1, 0]
};

document.addEventListener("keydown", event => {
  if (directions[event.key]) {
    event.preventDefault();
    move(...directions[event.key]);
  } else if (event.key.toLowerCase() === "z") undo();
  else if (event.key.toLowerCase() === "r") restartLevel();
});

document.querySelectorAll("[data-direction]").forEach(button => {
  const map = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  button.addEventListener("click", () => move(...map[button.dataset.direction]));
});

let touchStart = null;
board.addEventListener("pointerdown", event => { touchStart = { x: event.clientX, y: event.clientY }; });
board.addEventListener("pointerup", event => {
  if (!touchStart) return;
  const dx = event.clientX - touchStart.x;
  const dy = event.clientY - touchStart.y;
  touchStart = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
  if (Math.abs(dx) > Math.abs(dy)) move(Math.sign(dx), 0);
  else move(0, Math.sign(dy));
});

undoButton.addEventListener("click", undo);
restartButton.addEventListener("click", restartLevel);
randomLevelButton?.addEventListener("click", loadRandomLevel);
soundButton.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  soundButton.textContent = soundEnabled ? "♫" : "×";
  soundButton.title = soundEnabled ? "Выключить звук" : "Включить звук";
  soundButton.setAttribute("aria-label", soundButton.title);
});
nextButton.addEventListener("click", () => {
  winDialog.close();
  if (randomMode) loadRandomLevel();
  else loadLevel((currentLevel + 1) % LEVELS.length);
});
replayButton.addEventListener("click", () => {
  winDialog.close();
  restartLevel();
});

loadLevel(0);
