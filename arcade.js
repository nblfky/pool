(function() {
  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  const GAME_LIST = [
    { id: 'rocks',   title: 'Falling Rocks',    subtitle: 'Hit all falling rocks. No misses.', firstReward: 500, repeatReward: 50, requiredKeys: 0, render: renderFallingRocks },
    { id: 'flappy',  title: 'Flappy Flight',    subtitle: 'Pass 20 pipes to win.',             firstReward: 1000, repeatReward: 100, requiredKeys: 1, render: renderFlappy },
    { id: 'fish',    title: 'Fish Runner',      subtitle: 'Avoid obstacles for 60s.',         firstReward: 1500, repeatReward: 100, requiredKeys: 2, render: renderFish },
    { id: 'memory',  title: 'Memory Sprint',    subtitle: 'Match all pairs before timer.',     firstReward: 2000, repeatReward: 100, requiredKeys: 3, render: renderMemoryTimed },
    { id: 'rhythm',  title: 'Rhythm Tap',       subtitle: 'Tap every beat on time.',           firstReward: 2500, repeatReward: 100, requiredKeys: 4, render: renderRhythm },
  ];

  function isLocked(game) {
    const keys = (window.userProfile && window.userProfile.read && window.userProfile.read()) ? window.userProfile.read().arcadeKeys || 0 : 0;
    return keys < game.requiredKeys;
  }

  function renderHome(root) {
    root.innerHTML = '';

    const grid = document.createElement('div');
    grid.className = 'arcade-grid';

    GAME_LIST.forEach((game) => {
      const card = document.createElement('button');
      const locked = isLocked(game);
      card.className = 'arcade-card' + (locked ? ' is-locked' : '');
      card.setAttribute('data-game-id', game.id);
      const reqText = locked ? ` • Needs ${game.requiredKeys} key(s)` : '';
      card.innerHTML = `
        <div class="arcade-card__title">${game.title}</div>
        <div class="arcade-card__subtitle">${game.subtitle}${reqText}</div>
      `;
      card.addEventListener('click', () => {
        if (isLocked(game)) {
          alert('Locked. Earn a key from Quests to unlock the next game.');
          return;
        }
        renderGameScreen(root, game);
      });
      grid.appendChild(card);
    });

    root.appendChild(grid);
  }

  function renderGameScreen(root, game) {
    root.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'game-header';

    const title = document.createElement('h2');
    title.className = 'game-title';
    title.textContent = game.title;

    const controls = document.createElement('div');
    controls.className = 'game-controls';

    const backBtn = document.createElement('button');
    backBtn.className = 'btn';
    backBtn.textContent = 'Back';
    backBtn.addEventListener('click', () => renderHome(root));

    controls.appendChild(backBtn);
    header.appendChild(title);
    header.appendChild(controls);

    const area = document.createElement('div');
    area.className = 'game-area';

    const info = document.createElement('div');
    info.className = 'scoreboard';
    info.textContent = game.subtitle;

    root.appendChild(header);
    root.appendChild(info);
    root.appendChild(area);

    game.render({ container: area, info, onWin: () => handleWin(game, root), onLose: () => handleLose(root, game) });
  }

  function handleWin(game, root) {
    const p = window.userProfile && window.userProfile.read ? window.userProfile.read() : null;
    const completed = p && p.arcadeCompletions && p.arcadeCompletions[game.id];
    const reward = completed ? game.repeatReward : game.firstReward;
    if (window.userProfile && window.userProfile.addShards) {
      window.userProfile.addShards(reward);
    }
    if (!completed && window.userProfile && window.userProfile.setArcadeCompleted) {
      window.userProfile.setArcadeCompleted(game.id);
    }
    const msg = document.createElement('div');
    msg.className = 'scoreboard';
    msg.textContent = `You won! +${reward} MS`;
    root.appendChild(msg);
  }

  function handleLose(root, game) {
    const msg = document.createElement('div');
    msg.className = 'scoreboard';
    msg.textContent = 'You lost. Try again!';
    root.appendChild(msg);
  }

  // Game 1: Falling Rocks
  function renderFallingRocks(ctx) {
    const area = ctx.container;
    const totalRocks = 12;
    const rockSpeed = 120; // px per second
    const size = 28;
    let cleared = 0;
    let failed = false;

    const startBtn = document.createElement('button');
    startBtn.className = 'btn';
    startBtn.textContent = 'Start';
    area.appendChild(startBtn);

    startBtn.addEventListener('click', start);

    function start() {
      startBtn.remove();
      spawnSequential(0);
    }

    function spawnSequential(i) {
      if (i >= totalRocks) {
        if (!failed) ctx.onWin();
        return;
      }
      const rock = document.createElement('div');
      rock.style.position = 'absolute';
      rock.style.width = size + 'px';
      rock.style.height = size + 'px';
      rock.style.borderRadius = '6px';
      rock.style.background = 'linear-gradient(180deg,#4b5563,#111827)';
      rock.style.border = '1px solid #2b3444';
      rock.style.boxShadow = '0 6px 18px #00000066';
      rock.style.cursor = 'pointer';
      const rect = area.getBoundingClientRect();
      const x = Math.random() * Math.max(1, rect.width - size);
      rock.style.left = x + 'px';
      rock.style.top = '-30px';
      area.appendChild(rock);

      let y = -30;
      let last = performance.now();
      function step(ts) {
        if (failed) { rock.remove(); return; }
        const dt = (ts - last) / 1000;
        last = ts;
        y += rockSpeed * dt;
        rock.style.top = y + 'px';
        const h = area.clientHeight || 300;
        if (y > h - size) {
          failed = true;
          rock.remove();
          ctx.onLose();
          return;
        }
        if (rock.isConnected) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);

      rock.addEventListener('click', () => {
        if (!rock.isConnected) return;
        rock.remove();
        cleared += 1;
        spawnSequential(i + 1);
      });
    }
  }

  // Game 2: Flappy Flight
  function renderFlappy(ctx) {
    const area = ctx.container;
    area.style.position = 'relative';
    const header = ctx.info;
    const startBtn = document.createElement('button');
    startBtn.className = 'btn';
    startBtn.textContent = 'Start';
    area.appendChild(startBtn);

    let running = false;
    let bird, pipes = [], score = 0, rafId = 0;
    let y = 100, vy = 0;

    function start() {
      startBtn.remove();
      running = true;
      score = 0;
      header.textContent = 'Pass 20 pipes to win. Score: 0';
      bird = document.createElement('div');
      bird.style.position = 'absolute';
      bird.style.left = '40px';
      bird.style.top = y + 'px';
      bird.style.width = '28px';
      bird.style.height = '20px';
      bird.style.borderRadius = '6px';
      bird.style.background = '#f59e0b';
      area.appendChild(bird);
      spawnPipes();
      lastTs = performance.now();
      rafId = requestAnimationFrame(loop);
      window.addEventListener('keydown', onKey);
      area.addEventListener('click', flap);
    }

    function onKey(e) { if (e.key === ' ' || e.key === 'ArrowUp') { e.preventDefault(); flap(); } }
    function flap() { vy = -260; }

    let spawnTimer = 0;
    let lastTs = 0;
    function loop(ts) {
      if (!running) return;
      const dt = (ts - lastTs) / 1000; lastTs = ts;
      vy += 600 * dt;
      y += vy * dt;
      if (y < 0) y = 0;
      const h = area.clientHeight || 260;
      if (y > h - 20) { return fail(); }
      bird.style.top = y + 'px';

      spawnTimer += dt;
      if (spawnTimer > 1.2) { spawnTimer = 0; spawnPipes(); }
      updatePipes(dt);

      rafId = requestAnimationFrame(loop);
    }

    function spawnPipes() {
      const h = area.clientHeight || 260;
      const gap = 90;
      const topHeight = 30 + Math.random() * (h - gap - 60);
      const bottomTop = topHeight + gap;
      const pipeSpeed = 140;
      const pipeW = 40;
      const xStart = (area.clientWidth || 480) + pipeW;
      const top = createPipe(0, topHeight, xStart, pipeW);
      const bottom = createPipe(bottomTop, h - bottomTop, xStart, pipeW);
      pipes.push({ top, bottom, x: xStart, w: pipeW, speed: pipeSpeed, counted: false });
    }

    function createPipe(top, height, x, w) {
      const el = document.createElement('div');
      el.style.position = 'absolute';
      el.style.left = x + 'px';
      el.style.top = top + 'px';
      el.style.width = w + 'px';
      el.style.height = height + 'px';
      el.style.background = '#334155';
      el.style.border = '1px solid #2b3444';
      area.appendChild(el);
      return el;
    }

    function updatePipes(dt) {
      const birdRect = bird.getBoundingClientRect();
      const areaRect = area.getBoundingClientRect();
      for (let i = pipes.length - 1; i >= 0; i--) {
        const p = pipes[i];
        p.x -= p.speed * dt;
        p.top.style.left = p.x + 'px';
        p.bottom.style.left = p.x + 'px';
        if (!p.counted && p.x + p.w < 40) { p.counted = true; score++; header.textContent = `Pass 20 pipes to win. Score: ${score}`; if (score >= 20) return win(); }
        // collision
        const topRect = p.top.getBoundingClientRect();
        const bottomRect = p.bottom.getBoundingClientRect();
        if (rectsOverlap(birdRect, topRect) || rectsOverlap(birdRect, bottomRect)) return fail();
        if (p.x + p.w < -10) { p.top.remove(); p.bottom.remove(); pipes.splice(i,1); }
      }
    }

    function rectsOverlap(a, b) { return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom); }

    function win() { cleanup(); ctx.onWin(); }
    function fail() { cleanup(); ctx.onLose(); }
    function cleanup() {
      running = false;
      cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', onKey);
      area.removeEventListener('click', flap);
      pipes.forEach(p => { p.top.remove(); p.bottom.remove(); });
      pipes = [];
      if (bird && bird.isConnected) bird.remove();
    }

    startBtn.addEventListener('click', start);
  }

  // Game 3: Fish Runner
  function renderFish(ctx) {
    const area = ctx.container;
    area.style.position = 'relative';
    const header = ctx.info;
    const startBtn = document.createElement('button');
    startBtn.className = 'btn';
    startBtn.textContent = 'Start';
    area.appendChild(startBtn);

    let running = false, fish, y = 100, rafId = 0, obstacles = [], timeLeft = 60, timerId = 0;

    function start() {
      startBtn.remove();
      running = true;
      y = 100;
      timeLeft = 60;
      header.textContent = 'Avoid obstacles for 60s. Time: 60s';
      fish = document.createElement('div');
      fish.style.position = 'absolute';
      fish.style.left = '30px';
      fish.style.top = y + 'px';
      fish.style.width = '32px';
      fish.style.height = '18px';
      fish.style.borderRadius = '12px';
      fish.style.background = '#22c55e';
      area.appendChild(fish);
      window.addEventListener('keydown', onKey);
      rafId = requestAnimationFrame(loop);
      timerId = setInterval(() => { timeLeft -= 1; header.textContent = `Avoid obstacles for 60s. Time: ${timeLeft}s`; if (timeLeft <= 0) return win(); }, 1000);
    }

    function onKey(e) {
      if (e.key === 'ArrowUp') { e.preventDefault(); y -= 24; }
      if (e.key === 'ArrowDown') { e.preventDefault(); y += 24; }
      const h = area.clientHeight || 260;
      if (y < 0) y = 0; if (y > h - 18) y = h - 18;
      if (fish) fish.style.top = y + 'px';
    }

    let last = 0, spawnTimer = 0;
    function loop(ts) {
      if (!running) return;
      const dt = (ts - last) / 1000; last = ts;
      spawnTimer += dt;
      if (spawnTimer > 1.0) { spawnTimer = 0; spawnObstacle(); }
      updateObstacles(dt);
      rafId = requestAnimationFrame(loop);
    }

    function spawnObstacle() {
      const h = area.clientHeight || 260;
      const yPos = Math.random() * Math.max(1, h - 30);
      const el = document.createElement('div');
      el.style.position = 'absolute';
      el.style.top = yPos + 'px';
      el.style.left = (area.clientWidth || 480) + 'px';
      el.style.width = '26px';
      el.style.height = '26px';
      el.style.borderRadius = '6px';
      el.style.background = '#ef4444';
      area.appendChild(el);
      obstacles.push({ el, x: area.clientWidth || 480, y: yPos, speed: 160 });
    }

    function updateObstacles(dt) {
      const fishRect = fish.getBoundingClientRect();
      for (let i = obstacles.length - 1; i >= 0; i--) {
        const o = obstacles[i];
        o.x -= o.speed * dt;
        o.el.style.left = o.x + 'px';
        if (o.x < -40) { o.el.remove(); obstacles.splice(i,1); continue; }
        const oRect = o.el.getBoundingClientRect();
        if (rectsOverlap(fishRect, oRect)) return fail();
      }
    }

    function rectsOverlap(a, b) { return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom); }

    function win() { cleanup(); ctx.onWin(); }
    function fail() { cleanup(); ctx.onLose(); }
    function cleanup() {
      running = false;
      cancelAnimationFrame(rafId);
      clearInterval(timerId);
      window.removeEventListener('keydown', onKey);
      obstacles.forEach(o => o.el.remove());
      obstacles = [];
      if (fish && fish.isConnected) fish.remove();
    }

    startBtn.addEventListener('click', start);
  }

  // Game 4: Memory Sprint (timed)
  function renderMemoryTimed(ctx) {
    const symbols = ['🍜','🐮','💌','⭐','🎯','🎮','🌙','🔥'];
    const deck = shuffle([...symbols, ...symbols]);
    let first = null, second = null, lock = false, matches = 0, moves = 0;
    let timeLeft = 45; // seconds

    const header = ctx.info;
    header.textContent = `Match all pairs before time runs out. Time: ${timeLeft}s`;

    const grid = document.createElement('div');
    grid.className = 'memory-grid';
    ctx.container.appendChild(grid);

    const timerId = setInterval(() => {
      timeLeft -= 1;
      header.textContent = `Match all pairs before time runs out. Time: ${timeLeft}s`;
      if (timeLeft <= 0) { clearInterval(timerId); ctx.onLose(); }
    }, 1000);

    deck.forEach((sym, idx) => {
      const card = document.createElement('button');
      card.className = 'memory-card';
      card.setAttribute('data-idx', String(idx));
      card.setAttribute('aria-label', 'Memory card');
      const front = document.createElement('div');
      front.className = 'memory-face memory-face--front';
      front.textContent = '?';
      const back = document.createElement('div');
      back.className = 'memory-face memory-face--back';
      back.textContent = sym;
      card.appendChild(front);
      card.appendChild(back);
      card.addEventListener('click', () => onFlip(card, sym));
      grid.appendChild(card);
    });

    function onFlip(card, sym) {
      if (lock || card.classList.contains('is-flipped')) return;
      card.classList.add('is-flipped');
      if (!first) { first = { card, sym }; return; }
      if (!second) { second = { card, sym }; moves += 1; check(); }
    }
    function check() {
      if (!first || !second) return;
      if (first.sym === second.sym) {
        matches += 1; first = null; second = null;
        if (matches === symbols.length) { clearInterval(timerId); ctx.onWin(); }
        return;
      }
      lock = true;
      setTimeout(() => { first.card.classList.remove('is-flipped'); second.card.classList.remove('is-flipped'); first = null; second = null; lock = false; }, 650);
    }
    function shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; }
  }

  // Game 5: Rhythm Tap
  function renderRhythm(ctx) {
    const area = ctx.container;
    area.style.position = 'relative';
    const header = ctx.info;
    const startBtn = document.createElement('button');
    startBtn.className = 'btn';
    startBtn.textContent = 'Start';
    area.appendChild(startBtn);

    const beats = 16;
    const intervalMs = 600; // 100 BPM approx
    let current = -1, timerId = 0, windowOpen = false, hits = 0, missed = false;

    const circle = document.createElement('div');
    circle.style.position = 'absolute';
    circle.style.width = '120px';
    circle.style.height = '120px';
    circle.style.borderRadius = '999px';
    circle.style.border = '3px solid #7c3aed';
    circle.style.left = '50%';
    circle.style.top = '50%';
    circle.style.transform = 'translate(-50%, -50%)';
    circle.style.display = 'none';
    area.appendChild(circle);

    function start() {
      startBtn.remove();
      header.textContent = 'Tap on beat. Do not miss any.';
      circle.style.display = 'block';
      current = -1; hits = 0; missed = false;
      window.addEventListener('keydown', onKey);
      area.addEventListener('click', onHit);
      timerId = setInterval(nextBeat, intervalMs);
      nextBeat();
    }

    function nextBeat() {
      current += 1;
      if (current >= beats) return finish();
      windowOpen = true;
      circle.style.boxShadow = '0 0 24px #a78bfa88';
      setTimeout(() => { windowOpen = false; circle.style.boxShadow = 'none'; if (hits < current + 1 && !missed) { missed = true; finish(); } }, 200);
    }

    function onKey(e) { if (e.key === ' ' || e.key.toLowerCase() === 'k') { e.preventDefault(); onHit(); } }
    function onHit() { if (windowOpen) { hits += 1; } }

    function finish() {
      clearInterval(timerId);
      window.removeEventListener('keydown', onKey);
      area.removeEventListener('click', onHit);
      circle.style.display = 'none';
      if (!missed && hits >= beats) ctx.onWin(); else ctx.onLose();
    }

    startBtn.addEventListener('click', start);
  }

  function shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; }

  ready(() => {
    const root = document.getElementById('arcade-root');
    if (!root) return;
    renderHome(root);
  });
})();
