let board;
let dotnet;
let state;
let initialState;
let currentLevelId;
let history = [];
let moves = 0;
let soundEnabled = true;
let audioContext;
let touchStart;
let initialized = false;

const directions = {
    ArrowUp: [0, -1], w: [0, -1], W: [0, -1],
    ArrowDown: [0, 1], s: [0, 1], S: [0, 1],
    ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0],
    ArrowRight: [1, 0], d: [1, 0], D: [1, 0]
};

const key = (x, y) => `${x},${y}`;
const clone = value => structuredClone(value);
const positionSet = positions => new Set(positions.map(position => key(position.x, position.y)));

function normalize(level) {
    return {
        ...clone(level),
        wallsSet: positionSet(level.walls),
        floorsSet: positionSet(level.floors),
        goalsSet: positionSet(level.goals),
        boxesSet: positionSet(level.boxes)
    };
}

export function initialize(level, levelId, componentReference) {
    board = document.querySelector("#board");
    dotnet = componentReference;
    bindControls();
    loadLevel(level, levelId);
}

export function loadLevel(level, levelId) {
    state = normalize(level);
    initialState = clone(level);
    currentLevelId = levelId;
    history = [];
    moves = 0;
    render();
    setActiveLevel(levelId);
}

function snapshot() {
    return { player: clone(state.player), boxes: [...state.boxesSet], moves };
}

function move(deltaX, deltaY) {
    const dialog = document.querySelector("#win-dialog");
    if (!state || dialog?.open) return;

    const target = { x: state.player.x + deltaX, y: state.player.y + deltaY };
    const targetKey = key(target.x, target.y);
    if (!state.floorsSet.has(targetKey) || state.wallsSet.has(targetKey)) {
        playTone(100, .035);
        return;
    }

    if (state.boxesSet.has(targetKey)) {
        const beyondKey = key(target.x + deltaX, target.y + deltaY);
        if (!state.floorsSet.has(beyondKey) || state.boxesSet.has(beyondKey) || state.wallsSet.has(beyondKey)) {
            playTone(100, .035);
            return;
        }
        history.push(snapshot());
        state.boxesSet.delete(targetKey);
        state.boxesSet.add(beyondKey);
        playTone(210, .06);
    } else {
        history.push(snapshot());
        playTone(150, .025);
    }

    state.player = target;
    moves += 1;
    render();
    if ([...state.boxesSet].every(box => state.goalsSet.has(box))) setTimeout(showWin, 160);
}

function undo() {
    const previous = history.pop();
    if (!previous) return;
    state.player = previous.player;
    state.boxesSet = new Set(previous.boxes);
    moves = previous.moves;
    playTone(130, .04);
    render();
}

function restart() {
    loadLevel(initialState, currentLevelId);
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
            if (state.wallsSet.has(position)) tile.classList.add("wall");
            else if (state.floorsSet.has(position)) tile.classList.add(state.goalsSet.has(position) ? "goal" : "floor");

            if (state.boxesSet.has(position)) {
                const box = document.createElement("span");
                box.className = `box${state.goalsSet.has(position) ? " on-goal" : ""}`;
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

    const placed = [...state.boxesSet].filter(box => state.goalsSet.has(box)).length;
    document.querySelector("#moves-value").textContent = moves;
    document.querySelector("#boxes-value").textContent = `${placed} / ${state.boxesSet.size}`;
    document.querySelector("#undo-button").disabled = history.length === 0;
    document.querySelector("#game-hint").textContent = state.isRandom ? "Случайная решаемая расстановка" : "Доставьте все ящики на отмеченные места";
}

function showWin() {
    const dialog = document.querySelector("#win-dialog");
    document.querySelector("#win-summary").textContent = `Все ящики на местах за ${moves} ${moveWord(moves)}.`;
    document.querySelector("#next-button").innerHTML = state.isRandom
        ? "Новый случайный сектор <span>♻</span>"
        : currentLevelId === 10 ? "Начать сначала <span>↻</span>" : "Следующий уровень <span>→</span>";
    playVictory();
    dialog.showModal();
}

async function nextLevel() {
    const dialog = document.querySelector("#win-dialog");
    dialog.close();
    if (state.isRandom) {
        loadLevel(await dotnet.invokeMethodAsync("GetRandomLevelForJavaScript"), null);
        setActiveLevel(null);
    } else {
        const nextId = currentLevelId === 10 ? 1 : currentLevelId + 1;
        loadLevel(await dotnet.invokeMethodAsync("GetLevelForJavaScript", nextId), nextId);
        setActiveLevel(nextId);
    }
}

function setActiveLevel(levelId) {
    document.querySelectorAll("[data-level]").forEach(button => button.classList.toggle("active", Number(button.dataset.level) === levelId));
    document.querySelector("#random-level-button").classList.toggle("active", levelId === null);
    document.querySelector("#level-value").textContent = levelId === null ? "Случайный" : `${levelId} / 10`;
}

function moveWord(value) {
    if (value % 100 >= 11 && value % 100 <= 14) return "ходов";
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
    gain.gain.setValueAtTime(.035, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
}

function playVictory() {
    [330, 440, 554].forEach((tone, index) => setTimeout(() => playTone(tone, .18), index * 110));
}

function onKeyDown(event) {
    if (directions[event.key]) {
        event.preventDefault();
        move(...directions[event.key]);
    } else if (event.key.toLowerCase() === "z") undo();
    else if (event.key.toLowerCase() === "r") restart();
}

function bindControls() {
    if (initialized) return;
    initialized = true;
    document.addEventListener("keydown", onKeyDown);
    document.querySelector("#undo-button").addEventListener("click", undo);
    document.querySelector("#restart-button").addEventListener("click", restart);
    document.querySelector("#sound-button").addEventListener("click", event => {
        soundEnabled = !soundEnabled;
        event.currentTarget.textContent = soundEnabled ? "♫" : "×";
    });
    document.querySelector("#next-button").addEventListener("click", nextLevel);
    document.querySelector("#replay-button").addEventListener("click", () => {
        document.querySelector("#win-dialog").close();
        restart();
    });
    document.querySelectorAll("[data-direction]").forEach(button => {
        const directionMap = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
        button.addEventListener("click", () => move(...directionMap[button.dataset.direction]));
    });
    board.addEventListener("pointerdown", event => { touchStart = { x: event.clientX, y: event.clientY }; });
    board.addEventListener("pointerup", event => {
        if (!touchStart) return;
        const deltaX = event.clientX - touchStart.x;
        const deltaY = event.clientY - touchStart.y;
        touchStart = null;
        if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 24) return;
        if (Math.abs(deltaX) > Math.abs(deltaY)) move(Math.sign(deltaX), 0);
        else move(0, Math.sign(deltaY));
    });
}

export function dispose() {
    document.removeEventListener("keydown", onKeyDown);
    initialized = false;
}
