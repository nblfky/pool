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

    btn.appendChild(title);
    btn.appendChild(subtitle);

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

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function openLetter(letter) {
  const modal = document.getElementById('modal');
  const title = document.getElementById('modal-title');
  const body = document.getElementById('modal-body');

  title.textContent = letter.title;
  body.innerHTML = '';

  const variant = pickRandom(letter.variants);
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


