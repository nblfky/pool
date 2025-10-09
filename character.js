(function() {
  function ready(fn) { if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', fn); } else { fn(); } }

  function renderCharacter(root) {
    root.innerHTML = '';
    const p = window.userProfile && userProfile.read ? userProfile.read() : null;
    if (!p) return;

    const header = document.createElement('div');
    header.className = 'char-header';
    header.innerHTML = `
      <div class="char-identity">
        <div class="char-avatar">${p.avatar || '🙂'}</div>
        <div>
          <div class="char-name">${p.name || ''}</div>
          <div class="char-meta">LVL ${p.level} • ${p.level >= 10 ? 'EXP MAX' : `EXP ${p.exp}/${p.expToNext}`} • ${p.shards} MS</div>
        </div>
      </div>
    `;

    const stats = document.createElement('div');
    stats.className = 'char-stats';
    stats.innerHTML = `
      <div class="char-stat"><span>HP</span><strong>1,000</strong></div>
      <div class="char-stat"><span>ATK</span><strong>50</strong></div>
      <div class="char-stat"><span>DEF</span><strong>50</strong></div>
      <div class="char-stat"><span>LUCK</span><strong>50%</strong></div>
      <div class="char-stat"><span>CHARISMA</span><strong>100</strong></div>
    `;

    const equip = document.createElement('div');
    equip.className = 'char-equip';

    const slots = [
      { key: 'head', label: 'Head' },
      { key: 'body', label: 'Body' },
      { key: 'legs', label: 'Legs' },
      { key: 'accessory', label: 'Accessory' },
      { key: 'weapon', label: 'Weapon' },
    ];

    slots.forEach(slot => {
      equip.appendChild(renderEquipSlot(slot.key, slot.label, p));
    });

    root.appendChild(header);
    root.appendChild(stats);
    root.appendChild(equip);
  }

  function renderEquipSlot(slotKey, label, profile) {
    const wrap = document.createElement('div');
    wrap.className = 'equip-slot';

    const title = document.createElement('div');
    title.className = 'equip-title';
    title.textContent = label;

    const controls = document.createElement('div');
    controls.className = 'equip-controls';

    const select = document.createElement('select');
    select.className = 'equip-select';

    const none = document.createElement('option');
    none.value = '';
    none.textContent = '— None —';
    select.appendChild(none);

    const inv = profile.inventory || {};
    Object.keys(inv).forEach(id => {
      const registry = window.ITEMS_REGISTRY || {};
      const def = registry[id];
      if (!def || def.slot !== slotKey) return;
      const qty = inv[id];
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = `${def.name} (x${qty})`;
      select.appendChild(opt);
    });

    const current = (profile.equipped || {})[slotKey] || '';
    select.value = current;

    const applyBtn = document.createElement('button');
    applyBtn.className = 'btn';
    applyBtn.textContent = 'Equip';
    applyBtn.addEventListener('click', () => {
      const id = select.value;
      if (!id) {
        userProfile.unequipItem(slotKey);
      } else {
        const res = userProfile.equipItem ? userProfile.equipItem(slotKey, id) : { ok: false };
        if (!res.ok) { alert('You do not own this item.'); return; }
      }
      // re-render
      const root = document.getElementById('character-root');
      if (root) renderCharacter(root);
    });

    controls.appendChild(select);
    controls.appendChild(applyBtn);

    const equippedText = document.createElement('div');
    equippedText.className = 'equip-current';
    if (current) {
      const def = (window.ITEMS_REGISTRY || {})[current];
      equippedText.textContent = `Equipped: ${def ? def.name : current}`;
    } else {
      equippedText.textContent = 'Equipped: None';
    }

    wrap.appendChild(title);
    wrap.appendChild(controls);
    wrap.appendChild(equippedText);
    return wrap;
  }

  ready(() => {
    const root = document.getElementById('character-root');
    if (!root) return;
    renderCharacter(root);
  });
})();


