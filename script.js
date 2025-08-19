
(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const TILE = 24;
  const COLS = Math.floor(canvas.width / TILE);
  const ROWS = Math.floor(canvas.height / TILE);

  // DOM
  const scoreEl = document.getElementById('score');
  const highEl = document.getElementById('highscore');
  const speedEl = document.getElementById('speed');
  const listEl  = document.getElementById('powerups-list');
  const overlay = document.getElementById('overlay');
  const finalScore = document.getElementById('final-score');
  const modalTitle = document.getElementById('modal-title');

  document.getElementById('btn-restart').addEventListener('click', () => start(true));
  document.getElementById('again').addEventListener('click', () => start(true));
  const pauseBtn = document.getElementById('btn-pause');
  pauseBtn.addEventListener('click', togglePause);

  // touch dpad
  document.querySelectorAll('.dbtn').forEach(b => b.addEventListener('click', () => setDir(b.dataset.dir)));

  // state
  let snake, dir, pendingDir, food, score, timerId, paused, running;
  let powerUps = []; // {type,x,y,expiresAt}
  let effects = { dbl:false, slow:false, ghost:false }; // active
  let timers = {}; // effect name -> expire timestamp

  const EFFECT_DUR = 8000; // ms
  const BASE_DELAY = 120; // ms
  const SLOW_DELAY = 200;
  const PU_TYPES = ['dbl','slow','shrink','ghost','speed'];

  // colors
  const colors = {
    bg: '#020617', grid: 'rgba(255,255,255,0.04)',
    food: '#f472b6', head: '#7dd3fc', body: '#38bdf8',
    dbl: '#fbbf24', slow: '#60a5fa', shrink:'#34d399', ghost:'#a78bfa', speed:'#fb7185'
  };

  // high score
  highEl.textContent = localStorage.getItem('snake_high') || 0;

  // input
  window.addEventListener('keydown', (e) => {
    const k = e.key;
    if (k === 'ArrowUp') setDir('up');
    else if (k === 'ArrowDown') setDir('down');
    else if (k === 'ArrowLeft') setDir('left');
    else if (k === 'ArrowRight') setDir('right');
    else if (k.toLowerCase() === 'p') togglePause();
    else if (k.toLowerCase() === 'r') start(true);
  });

  function setDir(d) {
    // prevent reverse
    if (!dir) return;
    if (d === 'up' && dir.y === 1) return;
    if (d === 'down' && dir.y === -1) return;
    if (d === 'left' && dir.x === 1) return;
    if (d === 'right' && dir.x === -1) return;
    pendingDir = d;
  }

  function start(reset=false) {
    overlay.classList.add('hidden');
    paused = false;
    pauseBtn.textContent = '⏸ Pause';
    running = true;
    score = 0;
    scoreEl.textContent = score;
    snake = [{x: Math.floor(COLS/2), y: Math.floor(ROWS/2)}];
    for (let i=1;i<4;i++) snake.push({x: snake[0].x - i, y: snake[0].y});
    dir = {x:1,y:0}; pendingDir = 'right';
    powerUps = [];
    effects = { dbl:false, slow:false, ghost:false, speed:false };
    timers = {};
    food = randEmptyCell();
    spawnPowerUp(true);
    scheduleTick();
    draw();
  }

  function scheduleTick() {
    clearTimeout(timerId);
    if (!running || paused) return;
    const delay = effects.slow ? SLOW_DELAY : (effects.speed ? BASE_DELAY/1.7 : BASE_DELAY);
    timerId = setTimeout(tick, delay);
    speedEl.textContent = ( (effects.speed ? 1.7 : 1) * (effects.slow ? BASE_DELAY/SLOW_DELAY : 1) ).toFixed(1) + 'x';
  }

  function togglePause(){
    if (!running) return;
    paused = !paused;
    pauseBtn.textContent = paused ? '▶️ Resume' : '⏸ Pause';
    if (!paused) scheduleTick();
  }

  function tick(){
    if (!running || paused) return;
    if (pendingDir) {
      if (pendingDir === 'up') dir = {x:0,y:-1};
      if (pendingDir === 'down') dir = {x:0,y:1};
      if (pendingDir === 'left') dir = {x:-1,y:0};
      if (pendingDir === 'right') dir = {x:1,y:0};
      pendingDir = null;
    }

    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

    // TELEPORT walls (wrap around)
    if (head.x < 0) head.x = COLS - 1;
    if (head.x >= COLS) head.x = 0;
    if (head.y < 0) head.y = ROWS - 1;
    if (head.y >= ROWS) head.y = 0;

    // collision with self (unless ghost active)
    if (!effects.ghost && snake.some((s,i)=> i>0 && s.x===head.x && s.y===head.y)) {
      return gameOver();
    }

    snake.unshift(head);

    // eat food
    if (head.x === food.x && head.y === food.y) {
      score += effects.dbl ? 2 : 1;
      scoreEl.textContent = score;
      food = randEmptyCell();
      if (Math.random() < 0.45) spawnPowerUp(); // spawn chance
    } else {
      snake.pop();
    }

    // power-up pickups
    for (let i=0;i<powerUps.length;i++){
      const p = powerUps[i];
      if (head.x === p.x && head.y === p.y) {
        applyPowerUp(p.type);
        powerUps.splice(i,1); i--;
      } else if (Date.now() > p.expiresAt) {
        powerUps.splice(i,1); i--;
      }
    }

    updateEffects();
    draw();
    scheduleTick();
  }

  function gameOver(){
    running = false;
    clearTimeout(timerId);
    finalScore.textContent = score;
    overlay.classList.remove('hidden');
    const prev = Number(localStorage.getItem('snake_high') || 0);
    if (score > prev) {
      localStorage.setItem('snake_high', String(score));
      highEl.textContent = score;
      modalTitle.textContent = 'New High Score! 🎉';
    } else {
      modalTitle.textContent = 'Game Over';
    }
  }

  function randEmptyCell(){
    let x,y,tries=0;
    do {
      x = Math.floor(Math.random()*COLS);
      y = Math.floor(Math.random()*ROWS);
      tries++; if (tries>800) break;
    } while (snake.some(s=>s.x===x && s.y===y) || powerUps.some(p=>p.x===x && p.y===y));
    return {x,y};
  }

  function spawnPowerUp(initial=false){
    if (powerUps.length >= 3) return;
    const type = PU_TYPES[Math.floor(Math.random()*PU_TYPES.length)];
    const pos = randEmptyCell();
    powerUps.push({type, x:pos.x, y:pos.y, expiresAt: Date.now() + (initial?12000:15000)});
  }

  function applyPowerUp(type){
    if (type === 'dbl') {
      effects.dbl = true;
      timers.dbl = Date.now() + EFFECT_DUR;
    } else if (type === 'slow') {
      effects.slow = true;
      timers.slow = Date.now() + EFFECT_DUR;
    } else if (type === 'ghost') {
      effects.ghost = true;
      timers.ghost = Date.now() + EFFECT_DUR;
    } else if (type === 'shrink') {
      // trim tail by up to 4 (keep at least length 3)
      const cut = Math.min(4, Math.max(0, snake.length - 3));
      for (let i=0;i<cut;i++) snake.pop();
      // show short timer badge
      effects.shrink = true;
      timers.shrink = Date.now() + 1200;
    } else if (type === 'speed') {
      effects.speed = true;
      timers.speed = Date.now() + 6000;
    }
    updateEffects();
  }

  function updateEffects(){
    const now = Date.now();
    for (const k of Object.keys(timers)) {
      if (now > timers[k]) {
        delete timers[k];
        effects[k] = false;
      }
    }
    // keep UI badges
    renderBadges();
  }

  function renderBadges(){
    listEl.innerHTML = '';
    const map = { dbl:'2x Points', slow:'Slow-Mo', shrink:'Shrink', ghost:'Ghost', speed:'Speed Boost' };
    for (const k of ['dbl','slow','shrink','ghost','speed']) {
      if (effects[k]) {
        const li = document.createElement('li');
        const remain = timers[k] ? Math.ceil((timers[k]-Date.now())/1000) : 0;
        li.textContent = map[k] + (remain ? ` (${remain}s)` : '');
        li.style.background = '#07142a';
        listEl.appendChild(li);
      }
    }
  }

  // drawing
  function drawGrid(){
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    for (let x=0;x<=canvas.width;x+=TILE){
      ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,canvas.height); ctx.stroke();
    }
    for (let y=0;y<=canvas.height;y+=TILE){
      ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); ctx.stroke();
    }
  }

  function drawRect(x,y,col){
    ctx.fillStyle = col;
    ctx.fillRect(x*TILE+1, y*TILE+1, TILE-2, TILE-2);
  }

  function draw(){
    // background
    ctx.fillStyle = colors.bg || '#020617';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    drawGrid();

    // food
    drawRect(food.x, food.y, colors.food);

    // powerups
    powerUps.forEach(p => {
      const col = colors[p.type] || '#fff';
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(p.x*TILE, p.y*TILE, TILE, TILE);
      drawRect(p.x, p.y, col);
    });

    // snake
    for (let i=snake.length-1;i>=0;i--){
      const s = snake[i];
      drawRect(s.x, s.y, i===0 ? colors.head : colors.body);
    }
  }

  // start
  start();

})();