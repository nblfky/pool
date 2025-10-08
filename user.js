(function() {
  const PROFILE_KEY = 'app_profile_v1';

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  function readProfile() {
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return { name: String(parsed.name || ''), avatar: String(parsed.avatar || '🙂') };
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

    bar.appendChild(avatar);
    bar.appendChild(name);
    header.appendChild(bar);
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
      saveProfile({ name: trimmed, avatar: selectedAvatar });
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
  window.userProfile = { read: readProfile, save: saveProfile };
})();


