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
  let pulses = [];
  let lastTimestamp = performance.now();
  let timeline = 0;
  let colors = {
    glow: '#4a60ff',
    glowSecondary: '#8b5cf6',
  };

  const connectionLayers = [
    { alpha: 0.68, lineWidth: 0.95, swing: 5, phase: 0 },
    { alpha: 0.34, lineWidth: 1.35, swing: 10.5, phase: 1.6 },
    { alpha: 0.22, lineWidth: 0.6, swing: 15.5, phase: 3.2 },
  ];

  const pointer = {
    x: width / 2,
    y: height / 2,
    targetX: width / 2,
    targetY: height / 2,
    radius: 3,
    depth: 1,
    active: false,
    lastActive: 0,
    charge: 0,
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

  const particleCount = () => Math.floor(Math.min(200, (width * height) / 8500));
  const maxDistance = () => Math.min(260, Math.max(180, Math.sqrt(width * height) * 0.2));

  const createParticle = () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.18 + Math.random() * 0.5;
    const depth = 0.45 + Math.random() * 0.8;

    return {
      x: Math.random() * width,
      y: Math.random() * height,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: 0.6 + Math.random() * 1.8,
      depth,
      drift: Math.random() * Math.PI * 2,
      driftSpeed: 0.004 + Math.random() * 0.012,
    };
  };

  const populateParticles = () => {
    particles = Array.from({ length: particleCount() }, createParticle);
  };

  const updatePointer = (delta) => {
    const smoothing = 1 - Math.pow(0.86, delta / 16 || 1);
    pointer.x += (pointer.targetX - pointer.x) * smoothing;
    pointer.y += (pointer.targetY - pointer.y) * smoothing;
    pointer.charge *= Math.pow(0.92, delta / 16 || 1);
  };

  const updateParticles = (delta) => {
    const wrapMargin = 80;
    const limit = maxDistance();
    const fieldRadius = limit * 1.35;
    const frame = delta / 16 || 1;

    particles.forEach((particle) => {
      const depth = particle.depth || 0.6;
      const layerFactor = 0.55 + depth * 0.9;
      particle.x += particle.vx * frame * layerFactor;
      particle.y += particle.vy * frame * layerFactor;
      particle.drift += particle.driftSpeed * frame;
      particle.x += Math.cos(particle.drift) * 0.35 * frame * layerFactor;
      particle.y += Math.sin(particle.drift) * 0.35 * frame * layerFactor;

      const dx = pointer.x - particle.x;
      const dy = pointer.y - particle.y;
      const distanceSq = dx * dx + dy * dy;

      if (distanceSq < fieldRadius * fieldRadius) {
        const distance = Math.sqrt(distanceSq) || 1;
        const influence = (1 - distance / fieldRadius) * (pointer.active ? 0.45 : 0.25);
        const chargeBoost = 0.5 + pointer.charge * 0.8;
        particle.vx += ((dx / distance) * influence * chargeBoost * 0.04 * frame);
        particle.vy += ((dy / distance) * influence * chargeBoost * 0.04 * frame);
      }

      particle.vx *= 0.992;
      particle.vy *= 0.992;

      if (particle.x < -wrapMargin) particle.x = width + wrapMargin;
      if (particle.x > width + wrapMargin) particle.x = -wrapMargin;
      if (particle.y < -wrapMargin) particle.y = height + wrapMargin;
      if (particle.y > height + wrapMargin) particle.y = -wrapMargin;
    });
  };

  const updatePulses = (delta) => {
    const frame = delta / 16 || 1;
    pulses = pulses.filter((pulse) => {
      pulse.radius += frame * (42 + pulse.strength * 64);
      pulse.alpha *= Math.pow(0.88, frame);
      return pulse.alpha > 0.05;
    });
  };

  const drawParticle = (node, intensity = 1) => {
    const depth = node.depth || 0.8;
    const pulseBoost = node === pointer ? 1 + pointer.charge * 1.8 : 1;
    const baseMultiplier = node === pointer ? 2.4 : 1.8 + depth * 0.2;
    const radius = node.radius * baseMultiplier * pulseBoost;
    const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, radius * 3);
    gradient.addColorStop(0, colors.glow);
    gradient.addColorStop(0.65, colors.glowSecondary);
    gradient.addColorStop(1, 'transparent');

    ctx.save();
    ctx.globalAlpha = 0.45 * intensity;
    ctx.fillStyle = gradient;
    ctx.shadowColor = colors.glowSecondary;
    ctx.shadowBlur = 18 * intensity * (1 + (node.depth || 0.5) * 0.4);
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  const drawConnections = (nodes, elapsed) => {
    const limit = maxDistance();
    const limitSq = limit * limit;

    connectionLayers.forEach((layer) => {
      const offsetX = Math.cos(elapsed * 0.0008 + layer.phase) * layer.swing;
      const offsetY = Math.sin(elapsed * 0.0011 + layer.phase) * layer.swing;

      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.shadowColor = colors.glowSecondary;
      ctx.shadowBlur = 12 + layer.swing * 0.8;

      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distanceSq = dx * dx + dy * dy;

          if (distanceSq > limitSq) continue;

          const distance = Math.sqrt(distanceSq);
          const depthA = a.depth || 1;
          const depthB = b.depth || 1;
          const depthMix = (depthA + depthB) / 2;
          const alpha = (1 - distance / limit) * layer.alpha * (0.75 + depthMix * 0.35);
          if (alpha <= 0) continue;

          const startX = a.x + offsetX * depthA * 0.5;
          const startY = a.y + offsetY * depthA * 0.5;
          const endX = b.x - offsetX * depthB * 0.5;
          const endY = b.y - offsetY * depthB * 0.5;
          const gradient = ctx.createLinearGradient(startX, startY, endX, endY);
          gradient.addColorStop(0, colors.glow);
          gradient.addColorStop(1, colors.glowSecondary);

          ctx.globalAlpha = alpha;
          ctx.lineWidth = layer.lineWidth + depthMix * 0.6 + alpha * 0.9;
          ctx.strokeStyle = gradient;
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.lineTo(endX, endY);
          ctx.stroke();
        }
      }

      ctx.restore();
    });
  };

  const drawPulses = () => {
    pulses.forEach((pulse) => {
      const gradient = ctx.createRadialGradient(
        pulse.x,
        pulse.y,
        pulse.radius * 0.3,
        pulse.x,
        pulse.y,
        pulse.radius * 1.15
      );
      gradient.addColorStop(0, colors.glow);
      gradient.addColorStop(0.55, colors.glowSecondary);
      gradient.addColorStop(1, 'transparent');

      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = pulse.alpha;
      ctx.lineWidth = 2.5 + pulse.strength * 3;
      ctx.strokeStyle = gradient;
      ctx.shadowColor = colors.glowSecondary;
      ctx.shadowBlur = 26;
      ctx.beginPath();
      ctx.arc(pulse.x, pulse.y, pulse.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });
  };

  const render = (timestamp) => {
    animationFrame = requestAnimationFrame(render);

    const delta = Math.min(64, (timestamp || performance.now()) - lastTimestamp || 16);
    lastTimestamp = timestamp || performance.now();
    timeline += delta;

    ctx.clearRect(0, 0, width, height);

    updateParticles(delta);
    updatePointer(delta);
    updatePulses(delta);

    const pointerVisible =
      pointer.active || pointer.charge > 0.05 || Date.now() - pointer.lastActive < 1400;
    const nodes = pointerVisible ? [...particles, pointer] : particles;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    nodes.forEach((node) => drawParticle(node, node === pointer ? 1.4 : 1));
    ctx.restore();

    drawConnections(nodes, timeline);
    drawPulses();
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
    pulses = [];
    timeline = 0;
    lastTimestamp = performance.now();
    render(lastTimestamp);
  };

  reduceMotionQuery.addEventListener('change', start);

  window.addEventListener('resize', () => {
    if (reduceMotionQuery.matches) return;
    setCanvasSize();
    populateParticles();
  });

  const activatePointer = (x, y, boost = 0) => {
    const safeX = Number.isFinite(x) ? x : width / 2;
    const safeY = Number.isFinite(y) ? y : height / 2;
    pointer.targetX = safeX;
    pointer.targetY = safeY;
    pointer.active = true;
    pointer.lastActive = Date.now();
    if (boost > 0) {
      pointer.charge = Math.min(1.4, pointer.charge + boost);
    }
  };

  const releasePointer = () => {
    pointer.active = false;
    pointer.lastActive = Date.now();
  };

  const createPulse = (x, y, strength = 1) => {
    const safeX = Number.isFinite(x) ? x : width / 2;
    const safeY = Number.isFinite(y) ? y : height / 2;
    pulses.push({ x: safeX, y: safeY, radius: 0, alpha: 0.72 * strength, strength });
  };

  let lastPointerDown = 0;
  const supportsPointerEvents = 'onpointermove' in window;

  if (supportsPointerEvents) {
    window.addEventListener('pointermove', (event) => {
      if (!event.isPrimary) return;
      activatePointer(event.clientX, event.clientY);
    });

    window.addEventListener('pointerdown', (event) => {
      if (!event.isPrimary) return;
      lastPointerDown = performance.now();
      activatePointer(event.clientX, event.clientY, event.pointerType === 'touch' ? 0.95 : 0.75);
      createPulse(event.clientX, event.clientY, event.pointerType === 'touch' ? 1.3 : 1);
    });

    window.addEventListener('pointerup', releasePointer);
    window.addEventListener('pointercancel', releasePointer);
    window.addEventListener('pointerleave', releasePointer);
  } else {
    window.addEventListener('mousemove', (event) => {
      activatePointer(event.clientX, event.clientY);
    });

    window.addEventListener('mousedown', (event) => {
      lastPointerDown = performance.now();
      activatePointer(event.clientX, event.clientY, 0.75);
      createPulse(event.clientX, event.clientY, 1);
    });

    window.addEventListener('mouseup', releasePointer);

    window.addEventListener(
      'touchmove',
      (event) => {
        const touch = event.touches[0];
        if (!touch) return;
        activatePointer(touch.clientX, touch.clientY);
      },
      { passive: true }
    );

    window.addEventListener(
      'touchstart',
      (event) => {
        const touch = event.touches[0];
        if (!touch) return;
        lastPointerDown = performance.now();
        activatePointer(touch.clientX, touch.clientY, 0.95);
        createPulse(touch.clientX, touch.clientY, 1.35);
      },
      { passive: true }
    );

    window.addEventListener('touchend', releasePointer);
    window.addEventListener('touchcancel', releasePointer);
  }

  window.addEventListener('click', (event) => {
    if (performance.now() - lastPointerDown < 280) return;

    if (event.detail === 0 && document.activeElement) {
      const rect = document.activeElement.getBoundingClientRect?.();
      if (rect) {
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        createPulse(centerX, centerY, 0.7);
        activatePointer(centerX, centerY, 0.4);
        return;
      }
    }

    createPulse(event.clientX, event.clientY, 0.75);
    activatePointer(event.clientX, event.clientY, 0.4);
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
