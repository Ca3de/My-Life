document.getElementById('year').textContent = new Date().getFullYear();

const toggle = document.getElementById('theme-toggle');
const savedTheme = localStorage.getItem('theme');

if (savedTheme === 'dark') {
  document.body.classList.add('dark');
  toggle.setAttribute('aria-pressed', true);
}

toggle.addEventListener('click', () => {
  const dark = document.body.classList.toggle('dark');
  toggle.setAttribute('aria-pressed', dark);
  localStorage.setItem('theme', dark ? 'dark' : 'light');
});

const schedule = typeof window.requestAnimationFrame === 'function'
  ? window.requestAnimationFrame.bind(window)
  : (fn) => setTimeout(fn, 16);

document.querySelectorAll('img[data-fallback]').forEach((img) => {
  const container = img.closest('.app-card__media, .portrait');
  if (!container) return;

  const showImage = () => {
    img.classList.remove('is-hidden');
    container.classList.add('has-image');
  };

  const hideImage = () => {
    img.classList.add('is-hidden');
    container.classList.remove('has-image');
  };

  const evaluate = () => {
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      showImage();
    } else {
      hideImage();
    }
  };

  if (img.complete) {
    if (typeof img.decode === 'function') {
      img
        .decode()
        .then(showImage)
        .catch(hideImage);
    } else {
      evaluate();
    }
  } else {
    img.addEventListener('load', () => {
      schedule(evaluate);
    }, { once: true });
    img.addEventListener('error', hideImage, { once: true });
  }

  schedule(evaluate);
});
