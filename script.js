// Customize your letters here. Provide multiple variants per letter.
// Each variant can be a text or image item and one is chosen randomly on open.
// variant.type: 'text' | 'image'
const LETTERS = [
  {
    id: 'sad',
    title: "Open when you're sad",
    hint: 'A warm hug in words',
    variants: [
      {
        type: 'text',
        content: `Hey you,\n\nIt’s okay to feel heavy sometimes. Breathe. In for four, hold for four, out for four. Repeat a few times. You are loved more than you know, and this moment will pass. I’m proud of you for making it this far.\n\nClose your eyes, put your hand on your heart, and remember: I’m with you. Always. 💜`,
      },
      {
        type: 'text',
        content: `Take a deep breath and unclench your jaw. You don’t have to carry everything today. Let me hold some of it with you. One small step is enough.`,
      },
      {
        type: 'text',
        content: `You are stronger than this moment. Find a soft song, sip water, stretch your shoulders. I love you.`,
      },
    ],
  },
  {
    id: 'miss',
    title: 'Open when you miss me',
    hint: 'A little reminder of us',
    variants: [
      { type: 'image', content: 'assets/us-placeholder.jpg', caption: 'Together soon — promise.' },
      { type: 'text', content: `Close your eyes and feel my hand in yours. Count to five with me. I’m right there.` },
      { type: 'text', content: `Check your camera roll for our favorite photo and smile at how far we’ve come.` },
    ],
  },
  {
    id: 'happy',
    title: "Open when you're happy",
    hint: 'Celebrate this moment!',
    variants: [
      { type: 'text', content: `Yay! Tell me everything that made today great. I’m cheering with you! 🥳` },
      { type: 'text', content: `Bottle this feeling. Future-you will open it when needed. Proud of you.` },
      { type: 'text', content: `Do a tiny dance. Yes, now. Because you deserve joy.` },
    ],
  },
  {
    id: 'rainy',
    title: 'Open on a rainy day',
    hint: 'Cozy vibes only',
    variants: [
      { type: 'text', content: `Tea. Blanket. Playlist. Let the rain slow everything down. You’re safe here. 🌧️` },
      { type: 'text', content: `Light a candle and read a few pages of something soft. I’m beside you.` },
      { type: 'text', content: `Let’s watch the raindrops race down the window and make up stories.` },
    ],
  },
];

// In-memory tracking to avoid immediate repeats per letter
const lastVariantIndexById = {};

// 5-minute lock logic for any opened card (opened one stays accessible)
const LOCK_KEY = 'open_when_lock_info_v1';
const LOCK_MINUTES = 1;

function readLockInfo() {
  try {
    const raw = localStorage.getItem(LOCK_KEY);
    if (!raw) return null;
    // Backward compat: if raw is a number string, treat as until without allowedId
    if (/^\d+$/.test(raw)) {
      return { until: Number(raw), allowedId: null };
    }
    const obj = JSON.parse(raw);
    if (!obj || typeof obj.until !== 'number') return null;
    return { until: obj.until, allowedId: obj.allowedId || null };
  } catch (_) {
    return null;
  }
}

function writeLock(minutes, allowedId) {
  const until = Date.now() + minutes * 60 * 1000;
  const payload = { until, allowedId };
  try { localStorage.setItem(LOCK_KEY, JSON.stringify(payload)); } catch (_) {}
  return until;
}

function clearLockIfExpired() {
  const info = readLockInfo();
  if (!info) return false;
  if (Date.now() >= info.until) {
    try { localStorage.removeItem(LOCK_KEY); } catch (_) {}
    return true;
  }
  return false;
}

function isLockedForLetter(letterId) {
  const info = readLockInfo();
  if (!info) return false;
  const locked = Date.now() < info.until;
  if (!locked) {
    clearLockIfExpired();
    return false;
  }
  return info.allowedId ? letterId !== info.allowedId : true;
}

function getRemainingMs() {
  const info = readLockInfo();
  if (!info) return 0;
  const ms = info.until - Date.now();
  return ms > 0 ? ms : 0;
}

function formatDurationMs(ms) {
  const totalSeconds = Math.ceil(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function renderLetters() {
  const container = document.getElementById('letters');
  container.innerHTML = '';

  LETTERS.forEach((letter) => {
    const btn = document.createElement('button');
    btn.className = 'letter';
    btn.setAttribute('data-letter-id', letter.id);
    btn.setAttribute('aria-label', letter.title);

    const title = document.createElement('div');
    title.className = 'letter__title';
    title.textContent = letter.title;

    const subtitle = document.createElement('div');
    subtitle.className = 'letter__subtitle';
    subtitle.textContent = letter.hint;

    // Lock state (sad is always accessible)
    const isDisabled = isLockedForLetter(letter.id);
    if (isDisabled) {
      btn.disabled = true;
      btn.setAttribute('aria-disabled', 'true');
      const badge = document.createElement('span');
      badge.className = 'letter__badge letter__badge--lock';
      badge.setAttribute('data-countdown-for', letter.id);
      badge.textContent = `Locked ${formatDurationMs(getRemainingMs())}`;
      btn.appendChild(badge);
    }

    btn.appendChild(title);
    btn.appendChild(subtitle);

    btn.addEventListener('click', () => {
      // play pop animation
      btn.classList.remove('letter--pop');
      void btn.offsetWidth; // restart animation
      btn.classList.add('letter--pop');
      openLetter(letter);
    });
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        btn.classList.remove('letter--pop');
        void btn.offsetWidth;
        btn.classList.add('letter--pop');
        openLetter(letter);
      }
    });

    container.appendChild(btn);
  });
}

function pickRandomIndex(listLength) {
  if (listLength <= 1) return 0;
  let idx = Math.floor(Math.random() * listLength);
  return idx;
}

function openLetter(letter) {
  const modal = document.getElementById('modal');
  const title = document.getElementById('modal-title');
  const body = document.getElementById('modal-body');

  // Respect lock: only allow 'sad' while locked
  if (isLockedForLetter(letter.id)) {
    return;
  }

  title.textContent = letter.title;
  body.innerHTML = '';

  // Pick non-repeating variant index
  let idx = pickRandomIndex(letter.variants.length);
  const lastIdx = lastVariantIndexById[letter.id];
  if (letter.variants.length > 1 && idx === lastIdx) {
    // choose next index (wrap) to avoid immediate repeat
    idx = (idx + 1) % letter.variants.length;
  }
  lastVariantIndexById[letter.id] = idx;
  const variant = letter.variants[idx];
  if (variant.type === 'text') {
    const p = document.createElement('p');
    p.style.whiteSpace = 'pre-wrap';
    p.textContent = variant.content;
    body.appendChild(p);
  } else if (variant.type === 'image') {
    const img = document.createElement('img');
    img.src = variant.content;
    img.alt = variant.caption || letter.title;
    body.appendChild(img);
    if (variant.caption) {
      const cap = document.createElement('div');
      cap.style.marginTop = '8px';
      cap.style.color = '#a1a1aa';
      cap.textContent = variant.caption;
      body.appendChild(cap);
    }
  }

  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');

  // Start/refresh lock for any opened letter; keep current letter accessible
  writeLock(LOCK_MINUTES, letter.id);
  renderLetters();

  // focus management
  document.getElementById('modal-close').focus();
}

function closeModal() {
  const modal = document.getElementById('modal');
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
}

function setupModalControls() {
  const modal = document.getElementById('modal');
  const closeBtn = document.getElementById('modal-close');
  const okBtn = document.getElementById('modal-ok');
  const backdrop = modal.querySelector('[data-close-overlay]');

  const onKey = (e) => {
    if (e.key === 'Escape') closeModal();
  };
  document.addEventListener('keydown', onKey);

  closeBtn.addEventListener('click', closeModal);
  okBtn.addEventListener('click', closeModal);
  backdrop.addEventListener('click', closeModal);
}

function ready(fn) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fn);
  } else {
    fn();
  }
}

ready(() => {
  renderLetters();
  setupModalControls();
  // Countdown updater
  setInterval(() => {
    const container = document.getElementById('letters');
    if (!container) return;
    const remaining = getRemainingMs();
    const locked = remaining > 0;
    // Update countdown text
    container.querySelectorAll('.letter__badge--lock').forEach((el) => {
      el.textContent = `Locked ${formatDurationMs(remaining)}`;
    });
    // If lock expired, rerender to enable buttons
    if (!locked) {
      if (clearLockIfExpired()) {
        renderLetters();
      }
    }
  }, 1000);
});


