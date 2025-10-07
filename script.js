document.documentElement.classList.add('js-enabled');
document.getElementById('year').textContent = new Date().getFullYear();

const toggle = document.getElementById('theme-toggle');
const savedTheme = localStorage.getItem('theme');

const emitThemeChange = () => {
  const theme = document.body.classList.contains('dark') ? 'dark' : 'light';
  window.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
};

if (savedTheme === 'dark') {
  document.body.classList.add('dark');
  toggle.setAttribute('aria-pressed', true);
}

toggle.addEventListener('click', () => {
  const dark = document.body.classList.toggle('dark');
  toggle.setAttribute('aria-pressed', dark);
  localStorage.setItem('theme', dark ? 'dark' : 'light');
  emitThemeChange();
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

const initQuantumBackground = () => {
  const canvas = document.getElementById('quantum-background');

  if (!canvas || !canvas.getContext) {
    return null;
  }

  const ctx = canvas.getContext('2d');
  const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  let width = window.innerWidth;
  let height = window.innerHeight;
  let dpr = Math.min(2.5, window.devicePixelRatio || 1);
  let animationFrame;
  let particles = [];
  let colors = {
    glow: '#4a60ff',
    glowSecondary: '#8b5cf6',
  };

  const pointer = {
    x: width / 2,
    y: height / 2,
    targetX: width / 2,
    targetY: height / 2,
    radius: 3,
    active: false,
    lastActive: 0,
  };

  const setCanvasSize = () => {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(2.5, window.devicePixelRatio || 1);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    if (!pointer.active) {
      pointer.x = width / 2;
      pointer.y = height / 2;
      pointer.targetX = pointer.x;
      pointer.targetY = pointer.y;
    }
  };

  const updateColors = () => {
    const computed = getComputedStyle(document.body);
    const accentA = computed.getPropertyValue('--accent-color').trim() || '#4a60ff';
    const accentB = computed.getPropertyValue('--accent-color-2').trim() || '#8b5cf6';

    colors = {
      glow: accentA,
      glowSecondary: accentB,
    };
  };

  const particleCount = () => Math.floor(Math.min(180, (width * height) / 9000));
  const maxDistance = () => Math.min(240, Math.max(160, Math.sqrt(width * height) * 0.18));

  const createParticle = () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.25 + Math.random() * 0.55;

    return {
      x: Math.random() * width,
      y: Math.random() * height,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: 0.6 + Math.random() * 1.8,
      drift: Math.random() * Math.PI * 2,
      driftSpeed: 0.004 + Math.random() * 0.012,
    };
  };

  const populateParticles = () => {
    particles = Array.from({ length: particleCount() }, createParticle);
  };

  const updatePointer = () => {
    pointer.x += (pointer.targetX - pointer.x) * 0.12;
    pointer.y += (pointer.targetY - pointer.y) * 0.12;
  };

  const updateParticles = () => {
    const wrapMargin = 80;

    particles.forEach((particle) => {
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.drift += particle.driftSpeed;
      particle.x += Math.cos(particle.drift) * 0.35;
      particle.y += Math.sin(particle.drift) * 0.35;

      if (particle.x < -wrapMargin) particle.x = width + wrapMargin;
      if (particle.x > width + wrapMargin) particle.x = -wrapMargin;
      if (particle.y < -wrapMargin) particle.y = height + wrapMargin;
      if (particle.y > height + wrapMargin) particle.y = -wrapMargin;
    });
  };

  const drawParticle = (node, intensity = 1) => {
    const radius = node.radius * (node === pointer ? 3.6 : 2.4);
    const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, radius * 3);
    gradient.addColorStop(0, colors.glow);
    gradient.addColorStop(0.65, colors.glowSecondary);
    gradient.addColorStop(1, 'transparent');

    ctx.save();
    ctx.globalAlpha = 0.45 * intensity;
    ctx.fillStyle = gradient;
    ctx.shadowColor = colors.glowSecondary;
    ctx.shadowBlur = 18 * intensity;
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  const drawConnections = (nodes) => {
    const limit = maxDistance();
    const limitSq = limit * limit;

    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const a = nodes[i];
        const b = nodes[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const distanceSq = dx * dx + dy * dy;

        if (distanceSq > limitSq) continue;

        const distance = Math.sqrt(distanceSq);
        const alpha = 1 - distance / limit;
        const gradient = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
        gradient.addColorStop(0, colors.glow);
        gradient.addColorStop(1, colors.glowSecondary);

        ctx.save();
        ctx.globalAlpha = alpha * 0.55;
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 0.7 + alpha * 0.7;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.restore();
      }
    }
  };

  const render = () => {
    animationFrame = requestAnimationFrame(render);

    ctx.clearRect(0, 0, width, height);

    updateParticles();
    updatePointer();

    const pointerVisible = pointer.active || Date.now() - pointer.lastActive < 1400;
    const nodes = pointerVisible ? [...particles, pointer] : particles;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    nodes.forEach((node) => drawParticle(node, node === pointer ? 1.4 : 1));
    ctx.restore();

    drawConnections(nodes);
  };

  const start = () => {
    cancelAnimationFrame(animationFrame);

    if (reduceMotionQuery.matches) {
      canvas.classList.add('is-reduced');
      return;
    }

    canvas.classList.remove('is-reduced');
    setCanvasSize();
    populateParticles();
    updateColors();
    render();
  };

  reduceMotionQuery.addEventListener('change', start);

  window.addEventListener('resize', () => {
    if (reduceMotionQuery.matches) return;
    setCanvasSize();
    populateParticles();
  });

  const activatePointer = (x, y) => {
    pointer.targetX = x;
    pointer.targetY = y;
    pointer.active = true;
    pointer.lastActive = Date.now();
  };

  window.addEventListener('mousemove', (event) => {
    activatePointer(event.clientX, event.clientY);
  });

  window.addEventListener('mouseleave', () => {
    pointer.active = false;
    pointer.lastActive = Date.now();
  });

  window.addEventListener(
    'touchmove',
    (event) => {
      const touch = event.touches[0];
      if (!touch) return;
      activatePointer(touch.clientX, touch.clientY);
    },
    { passive: true }
  );

  window.addEventListener('touchend', () => {
    pointer.active = false;
    pointer.lastActive = Date.now();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(animationFrame);
    } else {
      start();
    }
  });

  start();

  return {
    updateColors,
  };
};

const quantumBackground = initQuantumBackground();

if (quantumBackground) {
  window.addEventListener('themechange', () => {
    quantumBackground.updateColors();
  });
}

emitThemeChange();
