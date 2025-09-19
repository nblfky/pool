(function() {
  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  const GAMES = [
    { id: 'reaction', title: 'Reaction Time', subtitle: 'Click when it turns green', render: renderReactionGame },
    { id: 'aim', title: 'Aim Trainer', subtitle: 'Click the moving target', render: renderAimTrainer },
    { id: 'memory', title: 'Memory Match', subtitle: 'Match all pairs', render: renderMemoryMatch },
  ];

  function renderHome(root) {
    root.innerHTML = '';

    const grid = document.createElement('div');
    grid.className = 'arcade-grid';

    GAMES.forEach((game) => {
      const card = document.createElement('button');
      card.className = 'arcade-card';
      card.setAttribute('data-game-id', game.id);
      card.innerHTML = `
        <div class="arcade-card__title">${game.title}</div>
        <div class="arcade-card__subtitle">${game.subtitle}</div>
      `;
      card.addEventListener('click', () => {
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

    root.appendChild(header);
    root.appendChild(area);

    game.render({ container: area });
  }

  // Reaction Time
  function renderReactionGame(ctx) {
    const state = { phase: 'idle', timeoutId: null, startTs: 0, bestMs: null };

    const panel = document.createElement('div');
    panel.className = 'reaction-panel reaction-panel--wait';

    const text = document.createElement('div');
    text.className = 'reaction-text';
    panel.appendChild(text);

    const actions = document.createElement('div');
    actions.className = 'game-actions';

    const startBtn = document.createElement('button');
    startBtn.className = 'btn';
    startBtn.textContent = 'Start';

    const best = document.createElement('div');
    best.className = 'scoreboard';
    best.textContent = 'Best: —';

    ctx.container.appendChild(panel);
    ctx.container.appendChild(actions);
    actions.appendChild(startBtn);
    actions.appendChild(best);

    function setPhase(phase) {
      state.phase = phase;
      panel.classList.remove('reaction-panel--wait', 'reaction-panel--ready', 'reaction-panel--too-soon');
      if (phase === 'waiting') {
        panel.classList.add('reaction-panel--wait');
        text.textContent = 'Wait for green…';
      } else if (phase === 'ready') {
        panel.classList.add('reaction-panel--ready');
        text.textContent = 'CLICK!';
      } else if (phase === 'too-soon') {
        panel.classList.add('reaction-panel--too-soon');
        text.textContent = 'Too soon. Click Start to try again.';
      } else {
        panel.classList.add('reaction-panel--wait');
        text.textContent = 'Click Start, then wait for green.';
      }
    }

    function start() {
      clearTimeout(state.timeoutId);
      setPhase('waiting');
      const delay = 1200 + Math.random() * 1800;
      state.timeoutId = setTimeout(() => {
        state.startTs = performance.now();
        setPhase('ready');
      }, delay);
    }

    function onClick() {
      if (state.phase === 'waiting') {
        clearTimeout(state.timeoutId);
        setPhase('too-soon');
        return;
      }
      if (state.phase === 'ready') {
        const ms = Math.round(performance.now() - state.startTs);
        text.textContent = `Your time: ${ms} ms. Click Start to try again.`;
        if (state.bestMs == null || ms < state.bestMs) {
          state.bestMs = ms;
          best.textContent = `Best: ${state.bestMs} ms`;
        }
        setPhase('idle');
      }
    }

    startBtn.addEventListener('click', start);
    panel.addEventListener('click', onClick);
    setPhase('idle');
  }

  // Aim Trainer
  function renderAimTrainer(ctx) {
    const state = { timeLeft: 20, score: 0, running: false, intervalId: null };

    const header = document.createElement('div');
    header.className = 'scoreboard';
    header.textContent = 'Time: 20s • Score: 0';

    const actions = document.createElement('div');
    actions.className = 'game-actions';

    const startBtn = document.createElement('button');
    startBtn.className = 'btn';
    startBtn.textContent = 'Start';

    const area = ctx.container;
    area.appendChild(header);
    area.appendChild(actions);
    actions.appendChild(startBtn);

    const target = document.createElement('div');
    target.className = 'target';

    function updateHeader() {
      header.textContent = `Time: ${state.timeLeft}s • Score: ${state.score}`;
    }

    function placeTarget() {
      const rect = area.getBoundingClientRect();
      const size = 48;
      const x = Math.random() * Math.max(1, rect.width - size);
      const y = Math.random() * Math.max(1, rect.height - size);
      target.style.left = `${x}px`;
      target.style.top = `${y}px`;
      if (!target.isConnected) {
        area.appendChild(target);
      }
    }

    function tick() {
      state.timeLeft -= 1;
      updateHeader();
      if (state.timeLeft <= 0) {
        stop();
      }
    }

    function start() {
      if (state.running) return;
      state.running = true;
      state.timeLeft = 20;
      state.score = 0;
      updateHeader();
      placeTarget();
      state.intervalId = setInterval(tick, 1000);
    }

    function stop() {
      state.running = false;
      clearInterval(state.intervalId);
      if (target.isConnected) target.remove();
      header.textContent = `Done! Final score: ${state.score}. Click Start to play again.`;
    }

    startBtn.addEventListener('click', start);
    target.addEventListener('click', (e) => {
      if (!state.running) return;
      state.score += 1;
      updateHeader();
      placeTarget();
      e.stopPropagation();
    });

    area.addEventListener('click', (e) => {
      if (!state.running) return;
      // Miss click, minor penalty
      state.score = Math.max(0, state.score - 1);
      updateHeader();
    });
  }

  // Memory Match
  function renderMemoryMatch(ctx) {
    const symbols = ['🍜','🐮','💌','⭐','🎯','🎮','🌙','🔥'];
    const deck = shuffle([...symbols, ...symbols]);

    let first = null;
    let second = null;
    let lock = false;
    let matches = 0;
    let moves = 0;

    const header = document.createElement('div');
    header.className = 'scoreboard';
    header.textContent = 'Find all pairs. Moves: 0';

    const grid = document.createElement('div');
    grid.className = 'memory-grid';

    ctx.container.appendChild(header);
    ctx.container.appendChild(grid);

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
      if (!first) {
        first = { card, sym };
        return;
      }
      if (!second) {
        second = { card, sym };
        moves += 1;
        header.textContent = `Find all pairs. Moves: ${moves}`;
        check();
      }
    }

    function check() {
      if (!first || !second) return;
      if (first.sym === second.sym) {
        matches += 1;
        first = null;
        second = null;
        if (matches === symbols.length) {
          header.textContent = `You won in ${moves} moves!`;
        }
        return;
      }
      lock = true;
      setTimeout(() => {
        first.card.classList.remove('is-flipped');
        second.card.classList.remove('is-flipped');
        first = null;
        second = null;
        lock = false;
      }, 700);
    }

    function shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const t = arr[i];
        arr[i] = arr[j];
        arr[j] = t;
      }
      return arr;
    }
  }

  ready(() => {
    const root = document.getElementById('arcade-root');
    if (!root) return;
    renderHome(root);
  });
})();


