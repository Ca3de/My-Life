document.documentElement.classList.add('js-enabled');
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

const assetVersion = document.documentElement.dataset.assetVersion || Date.now().toString(36);

const versionUrl = (url) => {
  if (!url) return '';
  return url.includes('?') ? `${url}&v=${assetVersion}` : `${url}?v=${assetVersion}`;
};

const preloadImage = (url) =>
  new Promise((resolve, reject) => {
    if (!url) {
      reject();
      return;
    }

    const test = new Image();
    test.onload = () => resolve(url);
    test.onerror = reject;
    test.src = url;
  });

const showImage = (img, container) => {
  img.classList.remove('is-hidden');
  container?.classList.add('has-image');
};

const hideImage = (img, container) => {
  img.classList.add('is-hidden');
  container?.classList.remove('has-image');
};

document.querySelectorAll('.asset-image').forEach((img) => {
  const container = img.closest('[data-base], .app-card__media, .portrait');
  const datasetSource = container?.dataset || {};
  const base = datasetSource.base || img.dataset.base || '';
  const extAttr = datasetSource.extensions || img.dataset.extensions || img.dataset.ext || '';
  const extensions = extAttr
    .split(',')
    .map((ext) => ext.trim())
    .filter(Boolean);

  const initialSrc = img.getAttribute('src');
  const candidates = [];

  if (initialSrc) {
    candidates.push(versionUrl(initialSrc));
  }

  if (base && extensions.length) {
    extensions.forEach((ext) => {
      const cleanExt = ext.replace(/^\./, '');
      const variations = new Set([
        cleanExt.toLowerCase(),
        cleanExt.toUpperCase(),
        cleanExt.charAt(0).toUpperCase() + cleanExt.slice(1).toLowerCase(),
      ]);

      variations.forEach((variant) => {
        candidates.push(versionUrl(`${base}.${variant}`));
      });
    });
  }

  const uniqueCandidates = Array.from(new Set(candidates.filter(Boolean)));

  if (!uniqueCandidates.length) {
    if (img.complete && img.naturalWidth > 0) {
      showImage(img, container);
    } else {
      img.addEventListener('load', () => showImage(img, container));
      img.addEventListener('error', () => hideImage(img, container));
    }
    return;
  }

  (async () => {
    for (const candidate of uniqueCandidates) {
      try {
        const resolved = await preloadImage(candidate);
        if (img.src !== resolved) {
          img.src = resolved;
        }
        showImage(img, container);
        return;
      } catch (error) {
        // try next candidate
      }
    }

    hideImage(img, container);
  })();
});

const animatedElements = document.querySelectorAll('[data-animate]');

if (animatedElements.length) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.15,
      rootMargin: '0px 0px -10% 0px',
    }
  );

  animatedElements.forEach((el) => {
    const delay = el.dataset.animateDelay;
    if (delay) {
      el.style.setProperty('--animate-delay', delay);
    }
    observer.observe(el);
  });
}

let lastScrollY = window.scrollY;
const navBar = document.querySelector('.nav-bar');

const handleScroll = () => {
  const currentY = window.scrollY;
  const direction = currentY > lastScrollY ? 'down' : 'up';
  lastScrollY = currentY;

  if (!navBar) return;

  if (currentY > 120) {
    navBar.classList.add('nav-bar--condensed');
    document.body.classList.add('has-scrolled');
  } else {
    navBar.classList.remove('nav-bar--condensed');
    document.body.classList.remove('has-scrolled');
  }

  if (direction === 'down' && currentY > 200) {
    navBar.classList.add('nav-bar--hidden');
  } else {
    navBar.classList.remove('nav-bar--hidden');
  }
};

window.addEventListener('scroll', handleScroll, { passive: true });
