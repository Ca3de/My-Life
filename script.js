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

const createCrossWindowBridge = (() => {
  const seen = new Set();

  return (storageKey, channelName) => {
    const listeners = new Set();
    const bridgeId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    let channel = null;

    const dispatch = (payload) => {
      if (!payload || payload.id === bridgeId) return;
      const signature = `${payload.id}:${payload.timestamp}`;
      if (seen.has(signature)) return;
      seen.add(signature);
      if (seen.size > 2000) {
        const oldest = seen.values().next().value;
        if (oldest) {
          seen.delete(oldest);
        }
      }

      listeners.forEach((listener) => listener(payload));
    };

    if ('BroadcastChannel' in window) {
      channel = new BroadcastChannel(channelName);
      channel.addEventListener('message', (event) => {
        if (!event?.data) return;
        dispatch(event.data);
      });
    }

    const storageHandler = (event) => {
      if (event.key !== storageKey || !event.newValue) return;
      try {
        const payload = JSON.parse(event.newValue);
        dispatch(payload);
      } catch (error) {
        // ignore malformed payloads
      }
    };

    window.addEventListener('storage', storageHandler);

    const emit = (type, data, { flush = false } = {}) => {
      const payload = {
        id: bridgeId,
        type,
        data,
        timestamp: Date.now(),
      };

      if (channel) {
        channel.postMessage(payload);
      }

      try {
        localStorage.setItem(storageKey, JSON.stringify(payload));
        if (flush) {
          localStorage.removeItem(storageKey);
        }
      } catch (error) {
        // localStorage may be unavailable
      }
    };

    const subscribe = (listener) => {
      if (typeof listener !== 'function') return () => {};
      listeners.add(listener);
      return () => listeners.delete(listener);
    };

    const destroy = () => {
      if (channel) {
        channel.close();
      }
      window.removeEventListener('storage', storageHandler);
      listeners.clear();
    };

    return {
      id: bridgeId,
      emit,
      subscribe,
      destroy,
    };
  };
})();

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
  let traces = [];
  let ripples = [];
  let lastTimestamp = performance.now();
  let timeline = 0;
  let colors = {
    glow: '#4a60ff',
    glowSecondary: '#8b5cf6',
  };
  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  const bridge = createCrossWindowBridge('quantum:interaction', 'quantum-entanglement');
  const broadcastId = bridge.id;

  let detailLevel = 1;
  let averageDelta = 16;
  let lastTraceBroadcast = 0;
  let lastLocalTrace = 0;

  const remotePointers = new Map();

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

  let hasWindowFocus = document.hasFocus();

  const setCanvasSize = () => {
    const prevWidth = width;
    const prevHeight = height;

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

    if (prevWidth && prevHeight && remotePointers.size) {
      const scaleX = width / prevWidth;
      const scaleY = height / prevHeight;
      remotePointers.forEach((node) => {
        node.x *= scaleX;
        node.y *= scaleY;
        node.targetX *= scaleX;
        node.targetY *= scaleY;
      });
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

  const computeParticleCount = () =>
    Math.floor(Math.min(140 * detailLevel, (width * height) / (9000 / detailLevel)));
  const maxDistance = () =>
    Math.min(240, Math.max(160, Math.sqrt(width * height) * (0.18 + detailLevel * 0.04)));

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

  const populateParticles = (force = false) => {
    const target = computeParticleCount();

    if (force) {
      particles = Array.from({ length: target }, createParticle);
      return;
    }

    if (particles.length > target) {
      particles.length = target;
      return;
    }

    while (particles.length < target) {
      particles.push(createParticle());
    }
  };

  const ensureRemotePointer = (id) => {
    if (!remotePointers.has(id)) {
      remotePointers.set(id, {
        x: width / 2,
        y: height / 2,
        targetX: width / 2,
        targetY: height / 2,
        radius: 2.1,
        depth: 0.95,
        charge: 0,
        life: 0,
        isRemote: true,
        lastPulse: 0,
        renderCore: false,
        renderConnections: false,
      });
    }

    const remote = remotePointers.get(id);
    if (typeof remote.renderCore === 'undefined') {
      remote.renderCore = false;
    }
    if (typeof remote.renderConnections === 'undefined') {
      remote.renderConnections = false;
    }

    return remote;
  };

  const normalized = (value, max) => (max ? clamp(value / max, 0, 1) : 0.5);

  let lastPointerBroadcast = 0;

  const broadcastPointer = (x, y, charge = 0, force = false) => {
    const now = performance.now();
    if (!force && now - lastPointerBroadcast < 60) return;
    lastPointerBroadcast = now;

    bridge.emit('pointer', {
      x: normalized(x, width),
      y: normalized(y, height),
      charge: clamp(charge, 0, 1.4),
    });
  };

  const broadcastPulse = (x, y, strength, charge = 0) => {
    bridge.emit(
      'pulse',
      {
        x: normalized(x, width),
        y: normalized(y, height),
        strength,
        charge: clamp(charge, 0, 1.4),
      },
      { flush: true }
    );
  };

  const broadcastTrace = (x, y, energy = 0.3, force = false) => {
    const now = performance.now();
    if (!force && now - lastTraceBroadcast < 110) return;
    lastTraceBroadcast = now;

    bridge.emit('trace', {
      x: normalized(x, width),
      y: normalized(y, height),
      energy: clamp(energy, 0, 1.8),
    });
  };

  const handleRemotePointer = (id, data = {}) => {
    const remote = ensureRemotePointer(id);
    const normX = clamp(data.x ?? 0.5, 0, 1);
    const normY = clamp(data.y ?? 0.5, 0, 1);
    const x = normX * width;
    const y = normY * height;
    const charge = clamp(data.charge ?? 0.35, 0, 1.2);

    if (!Number.isFinite(remote.x)) remote.x = x;
    if (!Number.isFinite(remote.y)) remote.y = y;

    remote.targetX = x;
    remote.targetY = y;
    remote.charge = Math.max(remote.charge || 0, charge);
    remote.life = 2000;

    leaveTrace(x, y, 0.22 + charge * 0.55, true);

    const now = Date.now();
    if (!remote.lastPulse || now - remote.lastPulse > 480) {
      spawnBurst(x, y, 0.45 + charge * 0.4, true);
      remote.lastPulse = now;
    }
  };

  const handleRemotePulse = (id, data = {}) => {
    handleRemotePointer(id, data);

    const remote = ensureRemotePointer(id);
    const normX = clamp(data.x ?? 0.5, 0, 1);
    const normY = clamp(data.y ?? 0.5, 0, 1);
    const x = normX * width;
    const y = normY * height;
    const strength = clamp(data.strength ?? 0.75, 0.3, 2);

    const now = Date.now();
    if (!remote.lastPulse || now - remote.lastPulse > 220) {
      spawnBurst(x, y, strength, true);
      remote.lastPulse = now;
    }

    remote.charge = Math.max(remote.charge || 0, clamp(data.charge ?? strength * 0.4, 0, 1.2));
  };

  const addTrace = (x, y, energy = 0.3, remote = false) => {
    const safeX = Number.isFinite(x) ? x : width / 2;
    const safeY = Number.isFinite(y) ? y : height / 2;
    const normalizedEnergy = clamp(energy, 0.05, 1.8);

    traces.push({
      x: safeX,
      y: safeY,
      energy: normalizedEnergy,
      radius: 18 + normalizedEnergy * 42,
      thickness: 1.1 + normalizedEnergy * 2.6,
      alpha: 0.28 + normalizedEnergy * 0.45,
      rotation: Math.random() * Math.PI * 2,
      spin: (remote ? -1 : 1) * (0.0006 + Math.random() * 0.0018),
      span: (0.45 + Math.random() * 0.9) * Math.PI,
      remote,
      life: 900 + normalizedEnergy * 900,
    });
  };

  const leaveTrace = (x, y, energy = 0.3, remote = false, force = false) => {
    const safeX = Number.isFinite(x) ? x : width / 2;
    const safeY = Number.isFinite(y) ? y : height / 2;

    if (!remote) {
      const now = performance.now();
      if (!force && now - lastLocalTrace < 60) return;
      lastLocalTrace = now;
      addTrace(safeX, safeY, energy, false);
      broadcastTrace(safeX, safeY, energy, force);
      return;
    }

    addTrace(safeX, safeY, energy, true);
  };

  const createRipple = (x, y, strength = 1, remote = false) => {
    const safeX = Number.isFinite(x) ? x : width / 2;
    const safeY = Number.isFinite(y) ? y : height / 2;
    const safeStrength = clamp(strength, 0.35, 2.2);
    const waveCount = 3;
    const speed = 0.012 + safeStrength * 0.0065;

    for (let i = 0; i < waveCount; i += 1) {
      ripples.push({
        x: safeX,
        y: safeY,
        progress: -i * 0.18,
        speed: speed * (1 + i * 0.18),
        strength: safeStrength,
        remote,
      });
    }
  };

  const spawnBurst = (x, y, strength = 1, remote = false) => {
    const safeStrength = clamp(strength, 0.3, 2.2);
    createPulse(x, y, safeStrength);
    createRipple(x, y, safeStrength, remote);
    leaveTrace(x, y, safeStrength * 0.7, remote, true);
  };

  const handleRemoteTrace = (data = {}) => {
    const normX = clamp(data.x ?? 0.5, 0, 1);
    const normY = clamp(data.y ?? 0.5, 0, 1);
    const x = normX * width;
    const y = normY * height;
    const energy = clamp(data.energy ?? 0.3, 0.05, 1.8);

    leaveTrace(x, y, energy, true, true);
  };

  const updatePointer = (delta) => {
    const smoothing = 1 - Math.pow(0.86, delta / 16 || 1);
    pointer.x += (pointer.targetX - pointer.x) * smoothing;
    pointer.y += (pointer.targetY - pointer.y) * smoothing;
    pointer.charge *= Math.pow(0.92, delta / 16 || 1);
  };

  const updateRemotePointers = (delta) => {
    if (!remotePointers.size) return;

    const smoothing = 1 - Math.pow(0.85, delta / 16 || 1);
    const fade = Math.pow(0.9, delta / 16 || 1);

    remotePointers.forEach((node, id) => {
      node.x += (node.targetX - node.x) * smoothing;
      node.y += (node.targetY - node.y) * smoothing;
      node.charge = (node.charge || 0) * fade;
      node.life -= delta;

      if (node.life <= 0) {
        remotePointers.delete(id);
      }
    });
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

      if (remotePointers.size) {
        remotePointers.forEach((remote) => {
          const rdx = remote.x - particle.x;
          const rdy = remote.y - particle.y;
          const remoteDistanceSq = rdx * rdx + rdy * rdy;

          if (remoteDistanceSq >= fieldRadius * fieldRadius) return;

          const remoteDistance = Math.sqrt(remoteDistanceSq) || 1;
          const remoteInfluence =
            (1 - remoteDistance / fieldRadius) * (0.18 + (remote.charge || 0) * 0.4);

          particle.vx += ((rdx / remoteDistance) * remoteInfluence * 0.038 * frame);
          particle.vy += ((rdy / remoteDistance) * remoteInfluence * 0.038 * frame);
        });
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

  const updateRipples = (delta) => {
    const frame = delta / 16 || 1;
    ripples = ripples.filter((ripple) => {
      ripple.progress += ripple.speed * frame;
      return ripple.progress < 1.25;
    });
  };

  const updateTraces = (delta) => {
    const frame = delta / 16 || 1;
    traces = traces.filter((trace) => {
      trace.life -= delta;
      trace.radius += frame * (8 + trace.energy * 28);
      trace.alpha *= Math.pow(0.88, frame);
      trace.rotation += trace.spin * delta;
      trace.span = Math.min(Math.PI * 1.8, trace.span + 0.0015 * delta);
      return trace.life > 0 && trace.alpha > 0.03;
    });
  };

  const drawParticle = (node, intensity = 1) => {
    const depth = node.depth || 0.8;
    const isPointer = node === pointer;
    const isRemote = Boolean(node.isRemote);
    const nodeCharge = node.charge || 0;
    const pulseBoost = isPointer ? 1 + pointer.charge * 1.8 : 1 + nodeCharge * 0.6;
    const baseMultiplier = isPointer ? 2.4 : isRemote ? 2.1 : 1.8 + depth * 0.2;
    const radius = node.radius * baseMultiplier * pulseBoost;
    const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, radius * 3);
    gradient.addColorStop(0, colors.glow);
    gradient.addColorStop(0.65, colors.glowSecondary);
    gradient.addColorStop(1, 'transparent');

    ctx.save();
    ctx.globalAlpha = (isPointer || isRemote ? 0.58 : 0.45) * intensity;
    ctx.fillStyle = gradient;
    ctx.shadowColor = colors.glowSecondary;
    ctx.shadowBlur = (isPointer ? 18 : 14) * intensity * (1 + (node.depth || 0.5) * 0.4);
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  const drawConnections = (nodes, elapsed) => {
    const limit = maxDistance();
    const limitSq = limit * limit;

    const neighborCap = Math.max(4, Math.floor(6 + detailLevel * 6));
    const stride = detailLevel < 0.75 ? 2 : 1;

    connectionLayers.forEach((layer) => {
      const offsetX = Math.cos(elapsed * 0.0008 + layer.phase) * layer.swing;
      const offsetY = Math.sin(elapsed * 0.0011 + layer.phase) * layer.swing;

      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.shadowColor = colors.glowSecondary;
      ctx.shadowBlur = 12 + layer.swing * 0.8;

      for (let i = 0; i < nodes.length; i += 1) {
        let neighbors = 0;
        let attempts = 0;

        for (let j = i + stride; j < nodes.length && neighbors < neighborCap; j += stride) {
          attempts += 1;
          if (attempts > neighborCap * (detailLevel < 0.85 ? 3 : 4)) break;
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
          neighbors += 1;
        }
      }

      ctx.restore();
    });
  };

  const drawTraces = () => {
    if (!traces.length) return;

    traces.forEach((trace) => {
      const radius = trace.radius;
      const gradient = ctx.createLinearGradient(
        trace.x - radius,
        trace.y - radius,
        trace.x + radius,
        trace.y + radius
      );

      if (trace.remote) {
        gradient.addColorStop(0, colors.glowSecondary);
        gradient.addColorStop(1, colors.glow);
      } else {
        gradient.addColorStop(0, colors.glow);
        gradient.addColorStop(1, colors.glowSecondary);
      }

      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = trace.alpha;
      ctx.lineWidth = trace.thickness;
      ctx.shadowColor = trace.remote ? colors.glow : colors.glowSecondary;
      ctx.shadowBlur = 18 + trace.energy * 26;
      ctx.strokeStyle = gradient;
      ctx.beginPath();
      ctx.arc(trace.x, trace.y, radius, trace.rotation, trace.rotation + trace.span);
      ctx.stroke();
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

  const drawRipples = () => {
    if (!ripples.length) return;

    ripples.forEach((ripple) => {
      if (ripple.progress <= 0) return;

      const eased = Math.min(1, ripple.progress);
      const radius = 28 + eased * (320 + ripple.strength * 140);
      const alpha = (1 - eased) * (ripple.remote ? 0.22 : 0.3) * (0.8 + ripple.strength * 0.25);

      if (alpha <= 0.01) {
        return;
      }

      const inner = radius * 0.55;
      const gradient = ctx.createRadialGradient(ripple.x, ripple.y, inner, ripple.x, ripple.y, radius);
      gradient.addColorStop(0, 'transparent');
      gradient.addColorStop(0.65, ripple.remote ? colors.glowSecondary : colors.glow);
      gradient.addColorStop(1, 'transparent');

      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 2.8 + ripple.strength * 3.2;
      ctx.strokeStyle = gradient;
      ctx.shadowColor = ripple.remote ? colors.glow : colors.glowSecondary;
      ctx.shadowBlur = 18 + ripple.strength * 22;
      ctx.beginPath();
      ctx.arc(ripple.x, ripple.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });
  };

  const render = (timestamp) => {
    animationFrame = requestAnimationFrame(render);

    const delta = Math.min(64, (timestamp || performance.now()) - lastTimestamp || 16);
    lastTimestamp = timestamp || performance.now();
    timeline += delta;
    averageDelta = averageDelta * 0.9 + delta * 0.1;

    let newDetail = detailLevel;
    if (averageDelta > 28 && detailLevel > 0.55) {
      newDetail = Math.max(0.55, detailLevel - 0.05);
    } else if (averageDelta < 18 && detailLevel < 1.08) {
      newDetail = Math.min(1.08, detailLevel + 0.03);
    }

    if (Math.abs(newDetail - detailLevel) > 0.005) {
      detailLevel = newDetail;
      populateParticles();
    }

    ctx.clearRect(0, 0, width, height);

    updateParticles(delta);
    updatePointer(delta);
    updateRemotePointers(delta);
    updatePulses(delta);
    updateRipples(delta);
    updateTraces(delta);

    const pointerVisible =
      hasWindowFocus &&
      (pointer.active || pointer.charge > 0.05 || Date.now() - pointer.lastActive < 1400);
    const remoteNodes = remotePointers.size ? Array.from(remotePointers.values()) : [];
    const pointerNodes = pointerVisible ? [pointer] : [];
    const renderNodes = [
      ...particles,
      ...pointerNodes,
      ...remoteNodes.filter((node) => node.renderCore !== false),
    ];
    const connectionNodes = [
      ...particles,
      ...pointerNodes,
      ...remoteNodes.filter((node) => node.renderConnections !== false),
    ];

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    renderNodes.forEach((node) => drawParticle(node, node === pointer || node.isRemote ? 1.25 : 1));
    ctx.restore();

    drawConnections(connectionNodes, timeline);
    drawTraces();
    drawPulses();
    drawRipples();
  };

  const start = () => {
    cancelAnimationFrame(animationFrame);

    if (reduceMotionQuery.matches) {
      canvas.classList.add('is-reduced');
      return;
    }

    canvas.classList.remove('is-reduced');
    setCanvasSize();
    populateParticles(true);
    updateColors();
    pulses = [];
    traces = [];
    ripples = [];
    timeline = 0;
    lastTimestamp = performance.now();
    pointer.active = false;
    pointer.charge = 0;
    pointer.lastActive = 0;
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
    broadcastPointer(pointer.x, pointer.y, 0, true);
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
      leaveTrace(event.clientX, event.clientY, 0.18 + pointer.charge * 0.8);
      broadcastPointer(
        event.clientX,
        event.clientY,
        pointer.active ? Math.max(pointer.charge, 0.25) : 0
      );
    });

    window.addEventListener('pointerdown', (event) => {
      if (!event.isPrimary) return;
      lastPointerDown = performance.now();
      const boost = event.pointerType === 'touch' ? 0.95 : 0.75;
      const burst = event.pointerType === 'touch' ? 1.3 : 1;
      activatePointer(event.clientX, event.clientY, boost);
      spawnBurst(event.clientX, event.clientY, burst);
      broadcastPulse(
        event.clientX,
        event.clientY,
        burst,
        pointer.charge
      );
      broadcastPointer(event.clientX, event.clientY, pointer.charge);
    });

    window.addEventListener('pointerup', releasePointer);
    window.addEventListener('pointercancel', releasePointer);
    window.addEventListener('pointerleave', releasePointer);
  } else {
    window.addEventListener('mousemove', (event) => {
      activatePointer(event.clientX, event.clientY);
      leaveTrace(event.clientX, event.clientY, 0.18 + pointer.charge * 0.8);
      broadcastPointer(
        event.clientX,
        event.clientY,
        pointer.active ? Math.max(pointer.charge, 0.25) : 0
      );
    });

    window.addEventListener('mousedown', (event) => {
      lastPointerDown = performance.now();
      activatePointer(event.clientX, event.clientY, 0.75);
      spawnBurst(event.clientX, event.clientY, 1);
      broadcastPulse(event.clientX, event.clientY, 1, pointer.charge);
      broadcastPointer(event.clientX, event.clientY, pointer.charge);
    });

    window.addEventListener('mouseup', releasePointer);

    window.addEventListener(
      'touchmove',
      (event) => {
        const touch = event.touches[0];
        if (!touch) return;
        activatePointer(touch.clientX, touch.clientY);
        leaveTrace(touch.clientX, touch.clientY, 0.2 + pointer.charge * 0.8);
        broadcastPointer(
          touch.clientX,
          touch.clientY,
          pointer.active ? Math.max(pointer.charge, 0.25) : 0
        );
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
        spawnBurst(touch.clientX, touch.clientY, 1.35);
        broadcastPulse(touch.clientX, touch.clientY, 1.35, pointer.charge);
        broadcastPointer(touch.clientX, touch.clientY, pointer.charge);
      },
      { passive: true }
    );

    window.addEventListener('touchend', releasePointer);
    window.addEventListener('touchcancel', releasePointer);
  }

  window.addEventListener('focus', () => {
    hasWindowFocus = true;
    pointer.lastActive = 0;
  });

  window.addEventListener('blur', () => {
    hasWindowFocus = false;
    pointer.active = false;
    pointer.charge = 0;
    pointer.lastActive = 0;
    broadcastPointer(pointer.x, pointer.y, 0, true);
  });

  window.addEventListener('click', (event) => {
    if (performance.now() - lastPointerDown < 280) return;

    if (event.detail === 0 && document.activeElement) {
      const rect = document.activeElement.getBoundingClientRect?.();
      if (rect) {
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        activatePointer(centerX, centerY, 0.4);
        spawnBurst(centerX, centerY, 0.7);
        broadcastPulse(centerX, centerY, 0.7, pointer.charge);
        broadcastPointer(centerX, centerY, pointer.charge);
        return;
      }
    }

    activatePointer(event.clientX, event.clientY, 0.4);
    spawnBurst(event.clientX, event.clientY, 0.75);
    broadcastPulse(event.clientX, event.clientY, 0.75, pointer.charge);
    broadcastPointer(event.clientX, event.clientY, pointer.charge);
  });

  bridge.subscribe((payload) => {
    if (!payload || payload.id === broadcastId) return;
    if (payload.timestamp && Date.now() - payload.timestamp > 4000) return;

    switch (payload.type) {
      case 'pointer':
        handleRemotePointer(payload.id, payload.data);
        break;
      case 'pulse':
        handleRemotePulse(payload.id, payload.data);
        break;
      case 'trace':
        handleRemoteTrace(payload.data);
        break;
      case 'leave':
        if (payload.id) {
          remotePointers.delete(payload.id);
        }
        break;
      default:
        break;
    }
  });

  document.addEventListener('visibilitychange', () => {
    hasWindowFocus = !document.hidden && document.hasFocus();

    if (document.hidden) {
      pointer.active = false;
      pointer.charge = 0;
      pointer.lastActive = 0;
      cancelAnimationFrame(animationFrame);
    } else {
      start();
    }
  });

  window.addEventListener('beforeunload', () => {
    bridge.emit('leave', {}, { flush: true });
    bridge.destroy();
    if (remotePointers.has(broadcastId)) {
      remotePointers.delete(broadcastId);
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
