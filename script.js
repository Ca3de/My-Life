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

  const base = img.dataset.base || '';
  const extensions = (img.dataset.ext || '')
    .split(',')
    .map((ext) => ext.trim())
    .filter(Boolean);

  const variants = [];
  const initialSrc = img.getAttribute('src');
  if (initialSrc) {
    variants.push(initialSrc);
  }

  if (base && extensions.length) {
    extensions.forEach((ext) => {
      const lower = ext.toLowerCase();
      const upper = ext.toUpperCase();
      const capitalized = ext.charAt(0).toUpperCase() + ext.slice(1).toLowerCase();

      [lower, upper, capitalized].forEach((variant) => {
        if (variant) {
          variants.push(`${base}.${variant}`);
        }
      });
    });
  }

  const uniqueVariants = Array.from(new Set(variants));
  let variantIndex = Math.max(uniqueVariants.findIndex((src) => src === initialSrc), 0);
  let currentVariant = initialSrc || uniqueVariants[variantIndex] || '';

  const setVariant = (index) => {
    if (index >= 0 && index < uniqueVariants.length) {
      variantIndex = index;
      const nextSrc = uniqueVariants[index];
      if (nextSrc && currentVariant !== nextSrc) {
        currentVariant = nextSrc;
        img.setAttribute('src', nextSrc);
      }
    }
  };

  const tryNextVariant = () => {
    if (variantIndex < uniqueVariants.length - 1) {
      setVariant(variantIndex + 1);
    } else {
      hideImage();
    }
  };

  const handleError = () => {
    if (uniqueVariants.length > 1) {
      tryNextVariant();
    } else {
      hideImage();
    }
  };

  const handleLoad = () => {
    showImage();
  };

  img.addEventListener('load', handleLoad);
  img.addEventListener('error', handleError);

  if (img.complete) {
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      showImage();
    } else if (typeof img.decode === 'function') {
      img
        .decode()
        .then(showImage)
        .catch(handleError);
    } else {
      handleError();
    }
  }
});
