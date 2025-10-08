(function() {
  const PROFILE_KEY = 'app_profile_v1';

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  function withDefaults(obj) {
    const level = Math.max(1, Math.min(10, Number(obj && obj.level || 1)));
    const expToNext = level >= 10 ? 0 : (100 + (level - 1) * 50);
    const exp = level >= 10 ? 0 : Math.max(0, Math.min(expToNext, Number(obj && obj.exp || 0)));
    const shards = Math.max(0, Number(obj && obj.shards || 0));
    return {
      name: String(obj && obj.name || ''),
      avatar: String(obj && obj.avatar || '🙂'),
      level,
      exp,
      expToNext,
      shards
    };
  }

  function readProfile() {
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return withDefaults(parsed);
    } catch (e) {
      return null;
    }
  }

  function saveProfile(profile) {
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    } catch (e) {}
  }

  function getPageName() {
    const path = (location.pathname || '').split('/');
    const last = path[path.length - 1] || 'index.html';
    return last.toLowerCase();
  }

  function expRequirementForLevel(level) {
    if (level >= 10) return 0;
    return 100 + (Math.max(1, level) - 1) * 50;
  }

  function addExp(amount) {
    const p = readProfile();
    if (!p) return null;
    if (p.level >= 10 || !Number.isFinite(amount) || amount <= 0) return p;
    let level = p.level;
    let exp = p.exp + amount;
    let expToNext = p.expToNext;
    while (level < 10) {
      if (exp < expToNext) break;
      exp -= expToNext;
      level += 1;
      expToNext = expRequirementForLevel(level);
    }
    if (level >= 10) {
      level = 10;
      exp = 0;
      expToNext = 0;
    }
    const updated = { ...p, level, exp, expToNext };
    saveProfile(updated);
    updateUserbar(updated);
    return updated;
  }

  function addShards(amount) {
    const p = readProfile();
    if (!p) return null;
    if (!Number.isFinite(amount) || amount <= 0) return p;
    const updated = { ...p, shards: p.shards + amount };
    saveProfile(updated);
    updateUserbar(updated);
    return updated;
  }

  function ensureProfile() {
    const page = getPageName();
    const profile = readProfile();
    if (!profile && page !== 'onboarding.html') {
      location.replace('onboarding.html');
      return null;
    }
    if (profile && page === 'onboarding.html') {
      location.replace('index.html');
      return profile;
    }
    return profile;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"]/g, function(ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch];
    });
  }

  function renderUserbar(profile) {
    if (!profile) return;
    const header = document.querySelector('.app-header');
    if (!header) return;
    if (header.querySelector('.userbar')) return;

    const bar = document.createElement('div');
    bar.className = 'userbar';

    const avatar = document.createElement('div');
    avatar.className = 'userbar__avatar';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = profile.avatar || '🙂';

    const name = document.createElement('div');
    name.className = 'userbar__name';
    name.textContent = profile.name || '';

    const stats = document.createElement('div');
    stats.className = 'userbar__stats';

    const lvl = document.createElement('div');
    lvl.className = 'userbar__stat';
    lvl.setAttribute('data-user-lvl', '');

    const exp = document.createElement('div');
    exp.className = 'userbar__stat';
    exp.setAttribute('data-user-exp', '');

    const ms = document.createElement('div');
    ms.className = 'userbar__stat';
    ms.setAttribute('data-user-ms', '');

    stats.appendChild(lvl);
    stats.appendChild(exp);
    stats.appendChild(ms);

    bar.appendChild(avatar);
    bar.appendChild(name);
    bar.appendChild(stats);
    header.appendChild(bar);

    updateUserbar(profile);
  }

  function updateUserbar(profile) {
    const bar = document.querySelector('.userbar');
    if (!bar) return;
    const p = profile || readProfile();
    if (!p) return;
    const lvlEl = bar.querySelector('[data-user-lvl]');
    const expEl = bar.querySelector('[data-user-exp]');
    const msEl = bar.querySelector('[data-user-ms]');
    if (lvlEl) lvlEl.textContent = `LVL ${p.level}`;
    if (expEl) expEl.textContent = p.level >= 10 ? 'EXP MAX' : `EXP ${p.exp}/${p.expToNext}`;
    if (msEl) msEl.textContent = `${p.shards} MS`;
  }

  function setupOnboarding() {
    const root = document.getElementById('onboarding-root');
    if (!root) return;

    const avatars = ['🐮','🍜','🦄','🐱','🐶','🐼','🐸','🐯','🐻','🐨','🦊','🐹','🐰','🦁','🐷'];

    const card = document.createElement('div');
    card.className = 'onboard-card';

    const title = document.createElement('h2');
    title.className = 'onboard-title';
    title.textContent = 'Welcome!';

    const desc = document.createElement('p');
    desc.className = 'onboard-desc';
    desc.textContent = 'Enter a nickname and choose an avatar to begin.';

    const form = document.createElement('form');
    form.className = 'onboard-form';
    form.setAttribute('autocomplete', 'off');

    const nameLabel = document.createElement('label');
    nameLabel.className = 'onboard-label';
    nameLabel.textContent = 'Nickname';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'onboard-input';
    nameInput.placeholder = 'e.g., BeefNoodleHero';
    nameInput.maxLength = 24;
    nameInput.required = true;

    const avatarsLabel = document.createElement('div');
    avatarsLabel.className = 'onboard-label';
    avatarsLabel.textContent = 'Choose an avatar';

    const grid = document.createElement('div');
    grid.className = 'avatar-grid';

    let selectedAvatar = avatars[0];
    avatars.forEach((av) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'avatar-choice';
      btn.setAttribute('aria-pressed', 'false');
      btn.textContent = av;
      btn.addEventListener('click', () => {
        selectedAvatar = av;
        grid.querySelectorAll('.avatar-choice').forEach((el) => {
          el.classList.remove('is-selected');
          el.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('is-selected');
        btn.setAttribute('aria-pressed', 'true');
      });
      grid.appendChild(btn);
    });
    // preselect first
    setTimeout(() => {
      const first = grid.querySelector('.avatar-choice');
      if (first) {
        first.classList.add('is-selected');
        first.setAttribute('aria-pressed', 'true');
      }
    });

    const actions = document.createElement('div');
    actions.className = 'onboard-actions';

    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.className = 'btn';
    submit.textContent = 'Continue';

    actions.appendChild(submit);

    form.appendChild(nameLabel);
    form.appendChild(nameInput);
    form.appendChild(avatarsLabel);
    form.appendChild(grid);
    form.appendChild(actions);

    form.addEventListener('submit', function(e) {
      e.preventDefault();
      const trimmed = (nameInput.value || '').trim();
      if (!trimmed) {
        nameInput.focus();
        return;
      }
      saveProfile(withDefaults({ name: trimmed, avatar: selectedAvatar, level: 1, exp: 0, shards: 0 }));
      location.replace('index.html');
    });

    card.appendChild(title);
    card.appendChild(desc);
    card.appendChild(form);
    root.appendChild(card);
  }

  ready(function() {
    const profile = ensureProfile();
    if (getPageName() !== 'onboarding.html') {
      renderUserbar(readProfile());
    }
    setupOnboarding();
  });

  // Optional: expose for debugging
  window.userProfile = { read: readProfile, save: saveProfile, addExp, addShards };
})();


