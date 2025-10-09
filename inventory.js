(function() {
  function ready(fn) { if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', fn); } else { fn(); } }

  function renderInventory(root) {
    root.innerHTML = '';
    const p = window.userProfile && userProfile.read ? userProfile.read() : null;
    const inv = p ? (p.inventory || {}) : {};
    const entries = Object.entries(inv);

    if (!entries.length) {
      const empty = document.createElement('p');
      empty.textContent = 'Your inventory is empty.';
      root.appendChild(empty);
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'inv-grid';

    entries.forEach(([id, qty]) => {
      const card = document.createElement('div');
      card.className = 'inv-card';
      card.innerHTML = `
        <div class="inv-card__img" aria-hidden="true">IMG</div>
        <div class="inv-card__meta">
          <div class="inv-card__name">${id}</div>
          <div class="inv-card__qty">x${qty}</div>
        </div>
      `;
      grid.appendChild(card);
    });

    root.appendChild(grid);
  }

  ready(() => {
    const root = document.getElementById('inventory-root');
    if (!root) return;
    renderInventory(root);
  });
})();


