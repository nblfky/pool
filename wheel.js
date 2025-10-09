(function() {
  function ready(fn) { if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', fn); } else { fn(); } }

  const COST_SPIN = 750;
  const COST_RESET = 2000;
  const COOLDOWN_MS = 12 * 60 * 60 * 1000; // 12h

  // 10 segments with different sizes → weights
  const SEGMENTS = [
    { id: 'ms_1500',  label: '+1500 MS', weight: 5,  action: () => userProfile.addShards(1500) },
    { id: 'ms_500',   label: '+500 MS',  weight: 5,  action: () => userProfile.addShards(500) },
    { id: 'potion_heal', label: 'Potion of Healing',  weight: 5,  action: () => userProfile.addItemToInventory('itm_potion_heal', 1) },
    { id: 'potion_weak', label: 'Potion of Weakness', weight: 5,  action: () => userProfile.addItemToInventory('itm_potion_weak', 1) },
    { id: 'ms_5000',  label: '+5000 MS', weight: 3,  action: () => userProfile.addShards(5000) },
    { id: 'hellblade', label: 'Hellblade',           weight: 3,  action: () => userProfile.addItemToInventory('wp_hellblade', 1) },
    { id: 'necklace', label: 'Necklace of Endurance',weight: 3,  action: () => userProfile.addItemToInventory('itm_necklace_endurance', 1) },
    { id: 'revive',   label: 'Revive Stone',         weight: 3,  action: () => userProfile.addItemToInventory('itm_revive_stone', 1) },
    { id: 'treat',    label: 'A treat from me',      weight: 1,  action: () => alert('A treat from me: You are amazing! 💜') },
    { id: 'gift',     label: 'A gift from me',       weight: 1,  action: () => alert('A gift from me: A big virtual hug! 🤗') },
  ];

  function weightedPick() {
    const total = SEGMENTS.reduce((s, x) => s + x.weight, 0);
    let r = Math.random() * total;
    for (let i = 0; i < SEGMENTS.length; i++) {
      const w = SEGMENTS[i].weight;
      if (r < w) return i;
      r -= w;
    }
    return SEGMENTS.length - 1;
  }

  function renderWheel(root) {
    root.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'scoreboard';
    updateHeader(header);

    const wheel = document.createElement('div');
    wheel.className = 'wheel';

    // draw segments
    const svgNS = 'http://www.w3.org/2000/svg';
    const size = 260;
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
    const cx = size / 2, cy = size / 2, r = size / 2 - 6;
    const totalW = SEGMENTS.reduce((s, x) => s + x.weight, 0);
    let startAngle = -90; // start at top
    SEGMENTS.forEach((seg, idx) => {
      const sweep = 360 * (seg.weight / totalW);
      const endAngle = startAngle + sweep;
      const path = document.createElementNS(svgNS, 'path');
      const largeArc = sweep > 180 ? 1 : 0;
      const start = polar(cx, cy, r, startAngle);
      const end = polar(cx, cy, r, endAngle);
      const d = [
        `M ${cx} ${cy}`,
        `L ${start.x} ${start.y}`,
        `A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`,
        'Z'
      ].join(' ');
      path.setAttribute('d', d);
      path.setAttribute('fill', segmentColor(idx));
      path.setAttribute('stroke', '#26262f');
      path.setAttribute('stroke-width', '1');
      svg.appendChild(path);

      // label
      const mid = polar(cx, cy, r * 0.6, startAngle + sweep / 2);
      const text = document.createElementNS(svgNS, 'text');
      text.setAttribute('x', String(mid.x));
      text.setAttribute('y', String(mid.y));
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'middle');
      text.setAttribute('fill', '#eaeaea');
      text.setAttribute('font-size', '11');
      text.textContent = seg.label;
      svg.appendChild(text);

      startAngle = endAngle;
    });

    const pointer = document.createElement('div');
    pointer.className = 'wheel-pointer';

    const actions = document.createElement('div');
    actions.className = 'game-actions';
    const spinBtn = document.createElement('button');
    spinBtn.className = 'btn';
    spinBtn.textContent = `Spin (${COST_SPIN} MS)`;
    const resetBtn = document.createElement('button');
    resetBtn.className = 'btn';
    resetBtn.textContent = `Reset Cooldown (${COST_RESET} MS)`;

    actions.appendChild(spinBtn);
    actions.appendChild(resetBtn);

    root.appendChild(header);
    root.appendChild(pointer);
    root.appendChild(wheel);
    wheel.appendChild(svg);
    root.appendChild(actions);

    let spinning = false;
    let rotation = 0;

    function canSpinNow() {
      const p = userProfile.read();
      return Date.now() >= (p.wheel && p.wheel.nextAt || 0);
    }

    function updateHeader(h) {
      const p = userProfile.read();
      const ms = Math.max(0, (p.wheel && p.wheel.nextAt || 0) - Date.now());
      if (ms <= 0) { h.textContent = 'Ready to spin!'; return; }
      const m = Math.ceil(ms / 60000);
      h.textContent = `Cooldown: ~${m} min left`;
    }

    function spend(cost) {
      const res = userProfile.spendShards ? userProfile.spendShards(cost) : { ok: false };
      if (!res.ok) {
        alert('Not enough MS.');
        return false;
      }
      return true;
    }

    function spin() {
      if (spinning) return;
      if (!canSpinNow()) { alert('Wheel on cooldown.'); return; }
      if (!spend(COST_SPIN)) return;
      spinning = true;
      const idx = weightedPick();
      const totalW = SEGMENTS.reduce((s, x) => s + x.weight, 0);
      // compute angle range for the chosen segment
      let start = -90;
      for (let i = 0; i < SEGMENTS.length; i++) {
        const sweep = 360 * (SEGMENTS[i].weight / totalW);
        const end = start + sweep;
        if (i === idx) {
          const mid = start + sweep / 2;
          const targetAngle = 360 * 5 + (360 - mid); // multiple spins then land so pointer at top
          animateTo(targetAngle, () => {
            SEGMENTS[idx].action();
            const p = userProfile.read();
            const nextAt = Date.now() + COOLDOWN_MS;
            userProfile.save({ ...p, wheel: { ...(p.wheel || {}), nextAt } });
            updateHeader(header);
            spinning = false;
          });
          return;
        }
        start = end;
      }
    }

    function resetCooldown() {
      if (spinning) return;
      if (!spend(COST_RESET)) return;
      const p = userProfile.read();
      userProfile.save({ ...p, wheel: { ...(p.wheel || {}), nextAt: 0 } });
      updateHeader(header);
    }

    function animateTo(target, onDone) {
      const start = rotation;
      const delta = target - start;
      const dur = 3000;
      let t0 = performance.now();
      function step(t) {
        const x = Math.min(1, (t - t0) / dur);
        const ease = 1 - Math.pow(1 - x, 3);
        rotation = start + delta * ease;
        wheel.style.transform = `rotate(${rotation}deg)`;
        if (x < 1) requestAnimationFrame(step); else onDone && onDone();
      }
      requestAnimationFrame(step);
    }

    spinBtn.addEventListener('click', spin);
    resetBtn.addEventListener('click', resetCooldown);

    setInterval(() => updateHeader(header), 60000);
  }

  function polar(cx, cy, r, deg) {
    const rad = (deg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }
  function segmentColor(i) {
    const palette = ['#1f2937','#334155','#4b5563','#6b7280','#7c3aed','#a78bfa','#0ea5e9','#06b6d4','#22c55e','#84cc16'];
    return palette[i % palette.length];
  }

  ready(() => {
    const root = document.getElementById('wheel-root');
    if (!root) return;
    renderWheel(root);
  });
})();


