(function() {
  function ready(fn) { if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', fn); } else { fn(); } }

  const CATALOG = [
    { cat: 'Head Gear', items: [
      { id: 'head_headband',           name: 'Headband',            price: 300 },
      { id: 'head_motorcycle_helmet',  name: 'Motorcycle Helmet',   price: 750 },
      { id: 'head_warrior_helmet',     name: 'Warrior Helmet',      price: 1500 },
      { id: 'head_sacred_mask',        name: 'Sacred Mask',         price: 3000 },
    ]},
    { cat: 'Body Gear', items: [
      { id: 'body_common_robe',        name: 'Common Robe',         price: 1000 },
      { id: 'body_army_vest',          name: 'Army Vest',           price: 1500 },
      { id: 'body_golden_chestplate',  name: 'Golden Chestplate',   price: 3000 },
      { id: 'body_sacred_armor',       name: 'Sacred Armor',        price: 7500 },
    ]},
    { cat: 'Leggings', items: [
      { id: 'leg_baggy_jeans',         name: 'Baggy Jeans',         price: 750 },
      { id: 'leg_army_trousers',       name: 'Army Trousers',       price: 1200 },
      { id: 'leg_legendary_leggings',  name: 'Legendary Leggings',  price: 3500 },
      { id: 'leg_sacred_guard',        name: 'Sacred Guard',        price: 5000 },
    ]},
    { cat: 'Accessory', items: [
      { id: 'acc_ring_rage',           name: 'Ring of Rage',        price: 1000 },
      { id: 'acc_ring_courage',        name: 'Ring of Courage',     price: 1000 },
      { id: 'acc_ring_hope',           name: 'Ring of Hope',        price: 1000 },
      { id: 'acc_ring_love',           name: 'Ring of Love',        price: 1000 },
    ]},
    { cat: 'Weapon', items: [
      { id: 'wp_kitchen_knife',        name: 'Common Kitchen Knife', price: 200 },
      { id: 'wp_sar21',                name: 'SAR21',               price: 1000 },
      { id: 'wp_royal_katana',         name: 'Royal Katana',        price: 1500 },
      { id: 'wp_deathreaper',          name: 'Deathreaper',         price: 4000 },
      { id: 'wp_soulstealer',          name: 'Soulstealer',         price: 7500 },
      { id: 'wp_sacred_blade',         name: 'Sacred Blade',        price: 10000 },
    ]},
    { cat: 'Items', items: [
      { id: 'itm_potion_heal',         name: 'Potion of Healing',   price: 500 },
      { id: 'itm_potion_weak',         name: 'Potion of Weakness',  price: 1000 },
      { id: 'itm_potion_power',        name: 'Potion of Power',     price: 1200 },
      { id: 'itm_potion_death',        name: 'Potion of Death',     price: 1500 },
    ]},
    { cat: 'Miscellaneous', items: [
      { id: 'misc_letter_key',         name: 'Letter Key',          price: 100 },
      { id: 'misc_adv_letter_key',     name: 'Advanced Letter Key', price: 500 },
      { id: 'misc_wheel_key',          name: 'Wheel of Fortune Key', price: 750 },
      { id: 'misc_adv_wheel_key',      name: 'Advanced Wheel of Fortune Key', price: 2000 },
      { id: 'misc_e_key',              name: 'E Key',               price: 10000 },
    ]},
  ];

  function renderShop(root) {
    root.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'shop-grid';

    CATALOG.forEach(section => {
      const sec = document.createElement('section');
      const h = document.createElement('h3');
      h.textContent = section.cat;
      h.className = 'shop-category';
      const row = document.createElement('div');
      row.className = 'shop-row';

      section.items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'shop-card';
        card.innerHTML = `
          <div class="shop-card__img" aria-hidden="true">IMG</div>
          <div class="shop-card__meta">
            <div class="shop-card__name">${item.name}</div>
            <div class="shop-card__price">${item.price} MS</div>
          </div>
        `;
        const btn = document.createElement('button');
        btn.className = 'btn';
        btn.textContent = 'Buy';
        btn.addEventListener('click', () => onBuy(item));
        card.appendChild(btn);
        row.appendChild(card);
      });

      sec.appendChild(h);
      sec.appendChild(row);
      grid.appendChild(sec);
    });

    root.appendChild(grid);
  }

  function onBuy(item) {
    if (!window.userProfile || !userProfile.purchaseItem) return;
    const res = userProfile.purchaseItem(item.id, item.price);
    if (!res.ok) {
      if (res.reason === 'insufficient_funds') alert('Not enough Memory Shards.');
      else alert('Unable to purchase.');
      return;
    }
    alert(`Purchased ${item.name} for ${item.price} MS.`);
  }

  ready(() => {
    const root = document.getElementById('shop-root');
    if (!root) return;
    renderShop(root);
  });
})();


