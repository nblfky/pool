// Customize your letters here. You can add text or image content.
// type: 'text' | 'image'
const LETTERS = [
  {
    id: 'sad',
    title: "Open when you're sad",
    hint: 'A warm hug in words',
    type: 'text',
    content: `Hey you,\n\nIt’s okay to feel heavy sometimes. Breathe. In for four, hold for four, out for four. Repeat a few times. You are loved more than you know, and this moment will pass. I’m proud of you for making it this far.\n\nClose your eyes, put your hand on your heart, and remember: I’m with you. Always. 💜`,
  },
  {
    id: 'miss',
    title: 'Open when you miss me',
    hint: 'A little reminder of us',
    type: 'image',
    content: 'assets/us-placeholder.jpg',
    caption: 'Together soon — promise.'
  },
  {
    id: 'happy',
    title: "Open when you're happy",
    hint: 'Celebrate this moment!',
    type: 'text',
    content: `Yay! I’m so happy you’re smiling right now. Save this feeling in your pocket and carry it into tomorrow. Tell me what made your day — I want to hear every detail. 🥳`,
  },
  {
    id: 'rainy',
    title: 'Open on a rainy day',
    hint: 'Cozy vibes only',
    type: 'text',
    content: `Grab a blanket, make some tea, and listen to the rain with me. Maybe put on our favorite playlist and let the day slow down. 🌧️`,
  },
];

const OPENED_KEY = 'open_when_opened_v1';

function getOpenedSet() {
  try {
    const raw = localStorage.getItem(OPENED_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch (_) {
    return new Set();
  }
}

function saveOpenedSet(openedSet) {
  try {
    localStorage.setItem(OPENED_KEY, JSON.stringify([...openedSet]));
  } catch (_) {
    // ignore
  }
}

function renderLetters() {
  const container = document.getElementById('letters');
  const opened = getOpenedSet();
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

    const status = document.createElement('span');
    status.className = 'letter__status' + (opened.has(letter.id) ? ' letter__status--opened' : '');
    status.textContent = opened.has(letter.id) ? 'Opened' : 'Unopened';

    btn.appendChild(title);
    btn.appendChild(subtitle);
    btn.appendChild(status);

    btn.addEventListener('click', () => openLetter(letter));
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openLetter(letter);
      }
    });

    container.appendChild(btn);
  });
}

function openLetter(letter) {
  const modal = document.getElementById('modal');
  const title = document.getElementById('modal-title');
  const body = document.getElementById('modal-body');

  title.textContent = letter.title;
  body.innerHTML = '';

  if (letter.type === 'text') {
    const p = document.createElement('p');
    p.style.whiteSpace = 'pre-wrap';
    p.textContent = letter.content;
    body.appendChild(p);
  } else if (letter.type === 'image') {
    const img = document.createElement('img');
    img.src = letter.content;
    img.alt = letter.caption || letter.title;
    body.appendChild(img);
    if (letter.caption) {
      const cap = document.createElement('div');
      cap.style.marginTop = '8px';
      cap.style.color = '#a1a1aa';
      cap.textContent = letter.caption;
      body.appendChild(cap);
    }
  }

  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');

  const opened = getOpenedSet();
  opened.add(letter.id);
  saveOpenedSet(opened);
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
});


