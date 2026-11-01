const cards = [...document.querySelectorAll('.project-card')];
const selectors = [...document.querySelectorAll('.selector')];
const carousel = document.getElementById('carousel');
const previous = document.getElementById('previous');
const next = document.getElementById('next');
const projectNav = document.getElementById('projectNav');
const projectToggle = document.getElementById('projectToggle');

let active = 0;
let pointerStart = null;
let dragOffset = 0;
let dragStartX = 0;
let dragLastX = 0;
let dragLastTime = 0;
let dragVelocity = 0;
let isDragging = false;
let dragMoved = false;
let suppressClick = false;
let wheelAccumulator = 0;
let wheelResetTimer = null;
let lastWheelAt = 0;

function linearDistance(index, current) {
  return index - current;
}

function getCardSpacing() {
  return window.innerWidth <= 760
    ? Math.min(window.innerWidth * 0.78, 330)
    : Math.min(Math.max(window.innerWidth * 0.36, 520), 640);
}

function updateCarousel() {
  const total = cards.length;
  const spacing = getCardSpacing();

  cards.forEach((card, index) => {
    const distance = linearDistance(index, active);
    const depth = Math.abs(distance);

    let x = distance * spacing;
    if (depth > 1) x *= 1.05;

    let liveOffset = dragOffset;
    if ((active === 0 && liveOffset > 0) ||
        (active === cards.length - 1 && liveOffset < 0)) {
      liveOffset *= 0.28;
    }

    x += liveOffset;

    const z = -depth * 220;
    const rotateY = distance * -19;
    const scale = 1 - depth * 0.105;

    card.style.transform =
      `translate(-50%, -50%)
       translate3d(${x}px, 0, ${z}px)
       rotateY(${rotateY}deg)
       scale(${scale})`;
    card.style.zIndex = String(20 - depth);
    card.style.opacity = depth === 0 ? '1' : depth === 1 ? '.72' : depth === 2 ? '.28' : '.10';
    card.style.filter = depth === 0 ? 'none' : `brightness(${Math.max(.82, 1 - depth * .09)}) saturate(${Math.max(.82, 1 - depth * .08)})`;
    card.classList.toggle('active', index === active);
  });

  selectors.forEach((selector, index) => {
    selector.classList.toggle('active', index === active);
  });

  previous.disabled = active === 0;
  next.disabled = active === cards.length - 1;
}

function resetTilt(card, slow = false) {
  const surface = card.querySelector('.card-surface');
  card.classList.remove('pointer-tilt');
  card.classList.toggle('tilt-reset', slow);
  if (!surface) return;
  surface.style.setProperty('--tilt-x', '0deg');
  surface.style.setProperty('--tilt-y', '0deg');
  surface.style.setProperty('--pointer-x', '50%');
  surface.style.setProperty('--pointer-y', '50%');
  surface.style.setProperty('--shift-x', '0px');
  surface.style.setProperty('--shift-y', '0px');

  if (slow) {
    window.setTimeout(() => card.classList.remove('tilt-reset'), 720);
  }
}

function setProject(index) {
  cards.forEach(resetTilt);
  active = Math.max(0, Math.min(cards.length - 1, index));
  updateCarousel();
}

function goNext() {
  if (active < cards.length - 1) setProject(active + 1);
}

function goPrevious() {
  if (active > 0) setProject(active - 1);
}

function setCarouselSpeed(milliseconds) {
  document.documentElement.style.setProperty('--carousel-speed', milliseconds + 'ms');
}

function clearWheelMotion() {
  wheelAccumulator = 0;
  lastWheelAt = 0;
  setCarouselSpeed(420);

  if (wheelResetTimer) {
    clearTimeout(wheelResetTimer);
    wheelResetTimer = null;
  }
}

next.addEventListener('click', () => {
  clearWheelMotion();
  goNext();
});

previous.addEventListener('click', () => {
  clearWheelMotion();
  goPrevious();
});

selectors.forEach((selector) => {
  selector.addEventListener('click', () => {
    clearWheelMotion();
    setProject(Number(selector.dataset.select));
  });
});

cards.forEach((card, index) => {
  card.addEventListener('click', (event) => {
    if (suppressClick) {
      event.preventDefault();
      return;
    }
    clearWheelMotion();
    if (index !== active) setProject(index);
  });
});

let tiltFrame = null;
let hoveredTiltCard = null;

function cardContainsPointer(card, x, y) {
  const surface = card.querySelector('.card-surface');
  if (!surface) return null;

  const rect = surface.getBoundingClientRect();
  const inside =
    x >= rect.left &&
    x <= rect.right &&
    y >= rect.top &&
    y <= rect.bottom;

  if (!inside) return null;

  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const normalizedDistance =
    Math.abs(x - centerX) / Math.max(1, rect.width) +
    Math.abs(y - centerY) / Math.max(1, rect.height);

  return { card, surface, rect, normalizedDistance };
}

function findVisualCardAtPointer(x, y) {
  const candidates = cards
    .map((card) => cardContainsPointer(card, x, y))
    .filter(Boolean);

  if (!candidates.length) return null;

  // In overlap regions, follow the card whose visible face is closest
  // to the pointer rather than relying on browser hit testing.
  candidates.sort((a, b) => a.normalizedDistance - b.normalizedDistance);
  return candidates[0];
}

function applyPointerTilt(card, surface, rect, clientX, clientY) {
  const index = cards.indexOf(card);
  if (index < 0) return;

  const px = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  const py = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

  const depth = Math.abs(index - active);
  const strength = depth === 0 ? 1 : depth === 1 ? 0.82 : 0.62;

  const maxTiltX = 9 * strength;
  const maxTiltY = 12 * strength;
  const maxShiftX = 18 * strength;
  const maxShiftY = 12 * strength;

  const tiltY = (px - 0.5) * maxTiltY * 2;
  const tiltX = (0.5 - py) * maxTiltX * 2;
  const shiftX = (px - 0.5) * maxShiftX;
  const shiftY = (py - 0.5) * maxShiftY;

  if (tiltFrame) cancelAnimationFrame(tiltFrame);
  tiltFrame = requestAnimationFrame(() => {
    card.classList.remove('tilt-reset');
    card.classList.add('pointer-tilt');
    surface.style.setProperty('--tilt-x', tiltX.toFixed(2) + 'deg');
    surface.style.setProperty('--tilt-y', tiltY.toFixed(2) + 'deg');
    surface.style.setProperty('--pointer-x', (px * 100).toFixed(1) + '%');
    surface.style.setProperty('--pointer-y', (py * 100).toFixed(1) + '%');
    surface.style.setProperty('--shift-x', shiftX.toFixed(2) + 'px');
    surface.style.setProperty('--shift-y', shiftY.toFixed(2) + 'px');
  });
}

function resetHoveredTiltCard(slow = true) {
  if (!hoveredTiltCard) return;
  resetTilt(hoveredTiltCard, slow);
  hoveredTiltCard = null;
}

carousel.addEventListener('pointermove', (event) => {
  if (isDragging || event.pointerType === 'touch') return;

  const hit = findVisualCardAtPointer(event.clientX, event.clientY);

  if (!hit) {
    resetHoveredTiltCard(true);
    return;
  }

  if (hoveredTiltCard && hoveredTiltCard !== hit.card) {
    resetTilt(hoveredTiltCard, true);
  }

  hoveredTiltCard = hit.card;
  applyPointerTilt(hit.card, hit.surface, hit.rect, event.clientX, event.clientY);
});

carousel.addEventListener('pointerleave', () => {
  if (isDragging) return;
  resetHoveredTiltCard(true);
});

window.addEventListener('blur', () => {
  resetHoveredTiltCard(true);
});

carousel.addEventListener('keydown', (event) => {
  clearWheelMotion();
  if (event.key === 'ArrowRight') goNext();
  if (event.key === 'ArrowLeft') goPrevious();
});

carousel.addEventListener('wheel', (event) => {
  const delta = Math.abs(event.deltaY) >= Math.abs(event.deltaX)
    ? event.deltaY
    : event.deltaX;

  if (Math.abs(delta) < 4) return;

  event.preventDefault();

  const now = performance.now();
  const rapidInput = lastWheelAt > 0 && (now - lastWheelAt) < 170;
  lastWheelAt = now;

  // A single wheel notch stays deliberate; sustained wheel input becomes fast.
  setCarouselSpeed(rapidInput ? 135 : 340);

  wheelAccumulator += delta;
  const threshold = 82;

  let steps = 0;
  while (Math.abs(wheelAccumulator) >= threshold && Math.abs(steps) < 3) {
    const direction = wheelAccumulator > 0 ? 1 : -1;
    steps += direction;
    wheelAccumulator -= direction * threshold;
  }

  if (steps !== 0) {
    const target = Math.max(0, Math.min(cards.length - 1, active + steps));
    if (target !== active) setProject(target);
  }

  if (wheelResetTimer) clearTimeout(wheelResetTimer);
  wheelResetTimer = window.setTimeout(() => {
    wheelAccumulator = 0;
    lastWheelAt = 0;
    setCarouselSpeed(420);
  }, 150);
}, { passive: false });

carousel.addEventListener('pointerdown', (event) => {
  if (event.pointerType === 'mouse' && event.button !== 0) return;

  clearWheelMotion();
  resetHoveredTiltCard(false);
  cards.forEach((card) => resetTilt(card, false));

  pointerStart = event.clientX;
  dragStartX = event.clientX;
  dragLastX = event.clientX;
  dragLastTime = performance.now();
  dragVelocity = 0;
  dragOffset = 0;
  dragMoved = false;
  isDragging = true;
  suppressClick = false;

  setCarouselSpeed(0);
  carousel.classList.add('dragging');
  carousel.setPointerCapture?.(event.pointerId);
});

carousel.addEventListener('pointermove', (event) => {
  if (!isDragging || pointerStart === null) return;

  const now = performance.now();
  const dx = event.clientX - dragStartX;
  const stepDx = event.clientX - dragLastX;
  const dt = Math.max(1, now - dragLastTime);

  dragVelocity = stepDx / dt;
  dragLastX = event.clientX;
  dragLastTime = now;

  dragOffset = dx;
  if (Math.abs(dx) > 6) dragMoved = true;

  updateCarousel();
});

function finishDrag(event) {
  if (!isDragging || pointerStart === null) return;

  const spacing = getCardSpacing();
  const projected = dragOffset + dragVelocity * 150;

  let step = Math.round(-projected / spacing);

  if (step === 0 && Math.abs(dragOffset) > 70) {
    step = dragOffset < 0 ? 1 : -1;
  }

  step = Math.max(-2, Math.min(2, step));

  const target = Math.max(0, Math.min(cards.length - 1, active + step));

  suppressClick = dragMoved;
  isDragging = false;
  pointerStart = null;
  dragOffset = 0;
  dragVelocity = 0;

  carousel.classList.remove('dragging');
  setCarouselSpeed(300);

  if (target !== active) {
    active = target;
  }

  updateCarousel();

  window.setTimeout(() => {
    setCarouselSpeed(420);
    suppressClick = false;
  }, 320);

  try {
    carousel.releasePointerCapture?.(event.pointerId);
  } catch (_) {}
}

carousel.addEventListener('pointerup', finishDrag);
carousel.addEventListener('pointercancel', finishDrag);

projectToggle.addEventListener('click', (event) => {
  event.stopPropagation();
  const open = projectNav.classList.toggle('open');
  projectToggle.setAttribute('aria-expanded', String(open));
});

document.querySelectorAll('[data-project]').forEach((button) => {
  button.addEventListener('click', () => {
    clearWheelMotion();
    setProject(Number(button.dataset.project));
    projectNav.classList.remove('open');
    projectToggle.setAttribute('aria-expanded', 'false');
  });
});

document.querySelectorAll('.future-link').forEach((link) => {
  link.addEventListener('click', (event) => event.preventDefault());
});

document.addEventListener('click', (event) => {
  if (!projectNav.contains(event.target)) {
    projectNav.classList.remove('open');
    projectToggle.setAttribute('aria-expanded', 'false');
  }
});

window.addEventListener('resize', updateCarousel);

updateCarousel();
