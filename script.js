const cards = [...document.querySelectorAll('.project-card')];
const carousel = document.getElementById('carousel');
const stage = carousel.querySelector('.stage');
const timelineOverview = document.getElementById('timelineOverview');
const timelineActiveRange = document.getElementById('timelineActiveRange');
const timelineEndMarker = document.getElementById('timelineEndMarker');
const timelineStartMarker = document.getElementById('timelineStartMarker');
const timelineEndLabel = document.getElementById('timelineEndLabel');
const timelineStartLabel = document.getElementById('timelineStartLabel');

const projectPeriods = [
  { endMonths: 0,  startMonths: 32, end: 'Present',   start: 'Mar. 2024' },
  { endMonths: 43, startMonths: 46, end: 'Apr. 2023', start: 'Jan. 2023' },
  { endMonths: 41, startMonths: 52, end: 'Jun. 2023', start: 'Jul. 2022' },
  { endMonths: 50, startMonths: 57, end: 'Sept. 2022', start: 'Feb. 2022' },
  { endMonths: 53, startMonths: 58, end: 'Jun. 2022', start: 'Jan. 2022' }
];
const previous = document.getElementById('previous');
const next = document.getElementById('next');
const projectNav = document.getElementById('projectNav');
const projectToggle = document.getElementById('projectToggle');
const imagePreview = document.getElementById('imagePreview');
const imagePreviewClose = document.getElementById('imagePreviewClose');

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
let pointerDownCardIndex = null;
let wheelAccumulator = 0;
let wheelResetTimer = null;
let lastWheelAt = 0;
let carouselSpeed = 420;
let pendingSettle = null;
let lastWheelStepAt = 0;
const tiltResetTimers = new WeakMap();

function linearDistance(index, current) {
  return index - current;
}

function getCardSpacing() {
  return window.innerWidth <= 760
    ? Math.min(window.innerWidth * 0.78, 330)
    : Math.min(Math.max(window.innerWidth * 0.45, 650), 800);
}

function getCardLayout(index) {
  const distance = linearDistance(index, active);
  const depth = Math.abs(distance);
  const spacing = getCardSpacing();

  let x = distance * spacing;
  if (depth > 1) x *= 1.05;

  let liveOffset = dragOffset;
  if ((active === 0 && liveOffset > 0) ||
      (active === cards.length - 1 && liveOffset < 0)) {
    liveOffset *= 0.28;
  }

  x += liveOffset;

  const centerX = Math.round(stage.clientWidth / 2);
  const centerY = Math.round(stage.clientHeight / 2);
  const card = cards[index];
  const left = Math.round(centerX - card.offsetWidth / 2 + x);
  const top = Math.round(centerY - card.offsetHeight / 2);

  return {
    distance,
    depth,
    left,
    top,
    z: -depth * 220,
    rotateY: distance * -19,
    scale: 1 - depth * 0.105
  };
}

function settleActiveCard() {
  if (isDragging || Math.abs(dragOffset) > 0.5) return;

  const card = cards[active];
  if (!card) return;

  const layout = getCardLayout(active);
  card.classList.add('native-snap');
  card.style.left = layout.left + 'px';
  card.style.top = layout.top + 'px';
  card.style.transform = 'none';

  requestAnimationFrame(() => {
    card.classList.remove('native-snap');
  });
}

function cancelPendingSettle() {
  if (!pendingSettle) return;

  const { card, handler, fallback } = pendingSettle;
  card?.removeEventListener('transitionend', handler);
  if (fallback) window.clearTimeout(fallback);
  pendingSettle = null;
}

function settleAfterMotion() {
  cancelPendingSettle();

  const card = cards[active];
  if (!card || isDragging) return;

  let finished = false;

  const finish = () => {
    if (finished) return;
    finished = true;
    cancelPendingSettle();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!isDragging && card === cards[active]) {
          settleActiveCard();
        }
      });
    });
  };

  const handler = (event) => {
    if (event.target === card && event.propertyName === 'transform') {
      finish();
    }
  };

  card.addEventListener('transitionend', handler);
  const fallback = window.setTimeout(finish, Math.max(460, carouselSpeed + 140));
  pendingSettle = { card, handler, fallback };
}

function prepareCarouselMotion() {
  cancelPendingSettle();

  cards.forEach((card, index) => {
    const layout = getCardLayout(index);
    card.classList.add('motion-prep');
    card.style.left = '0px';
    card.style.top = '0px';
    card.style.transform =
      `translate3d(${layout.left}px, ${layout.top}px, ${layout.z}px)
       rotateY(${layout.rotateY}deg)
       scale(${layout.scale})`;
  });

  void stage.offsetWidth;
  cards.forEach((card) => card.classList.remove('motion-prep'));
}

function updateTimelineRange(index) {
  if (!timelineOverview || !timelineActiveRange ||
      !timelineEndMarker || !timelineStartMarker ||
      !timelineEndLabel || !timelineStartLabel) return;

  const period = projectPeriods[index] || projectPeriods[0];
  const minPct = 7;
  const spanPct = 86;
  const totalMonths = 58;

  const endPct = minPct + (period.endMonths / totalMonths) * spanPct;
  const startPct = minPct + (period.startMonths / totalMonths) * spanPct;
  const left = Math.min(endPct, startPct);
  const width = Math.max(1.4, Math.abs(startPct - endPct));

  timelineActiveRange.style.left = left.toFixed(2) + '%';
  timelineActiveRange.style.width = width.toFixed(2) + '%';

  timelineEndMarker.style.left = endPct.toFixed(2) + '%';
  timelineStartMarker.style.left = startPct.toFixed(2) + '%';
  timelineEndLabel.textContent = period.end;
  timelineStartLabel.textContent = period.start;

  timelineOverview.classList.toggle('compact-range', width < 11);
}

function updateCarousel(nativeActive = false) {
  cards.forEach((card, index) => {
    const layout = getCardLayout(index);
    const { depth } = layout;

    if (nativeActive && depth === 0 && !isDragging && Math.abs(dragOffset) < 0.5) {
      card.classList.add('native-snap');
      card.style.left = layout.left + 'px';
      card.style.top = layout.top + 'px';
      card.style.transform = 'none';
      requestAnimationFrame(() => card.classList.remove('native-snap'));
    } else {
      card.style.left = '0px';
      card.style.top = '0px';
      card.style.transform =
        `translate3d(${layout.left}px, ${layout.top}px, ${layout.z}px)
         rotateY(${layout.rotateY}deg)
         scale(${layout.scale})`;
    }
    card.style.zIndex = String(20 - depth);
    card.style.opacity = depth === 0 ? '1' : depth === 1 ? '.72' : depth === 2 ? '.28' : '.10';
    card.style.filter = depth === 0 ? 'none' : `brightness(${Math.max(.82, 1 - depth * .09)}) saturate(${Math.max(.82, 1 - depth * .08)})`;
    card.classList.toggle('active', index === active);
  });

  updateTimelineRange(active);

  previous.disabled = active === 0;
  next.disabled = active === cards.length - 1;
}

function clearTiltResetTimer(card) {
  const timer = tiltResetTimers.get(card);
  if (timer) {
    window.clearTimeout(timer);
    tiltResetTimers.delete(card);
  }
}

function resetTilt(card, slow = false) {
  const surface = card.querySelector('.card-surface');
  clearTiltResetTimer(card);
  if (!surface) return;

  const hadTilt = card.classList.contains('pointer-tilt');

  surface.style.setProperty('--tilt-x', '0deg');
  surface.style.setProperty('--tilt-y', '0deg');
  surface.style.setProperty('--pointer-x', '50%');
  surface.style.setProperty('--pointer-y', '50%');
  surface.style.setProperty('--shift-x', '0px');
  surface.style.setProperty('--shift-y', '0px');

  if (slow && hadTilt) {
    // Keep pointer-tilt active during the return so transform:none does not
    // override the transition. Remove it only after the card has eased home.
    card.classList.add('tilt-reset');

    const timer = window.setTimeout(() => {
      card.classList.remove('pointer-tilt', 'tilt-reset');
      tiltResetTimers.delete(card);
      if (card.classList.contains('active')) settleActiveCard();
    }, 640);

    tiltResetTimers.set(card, timer);
    return;
  }

  card.classList.remove('pointer-tilt', 'tilt-reset');
}

function setProject(index, settle = true) {
  const target = Math.max(0, Math.min(cards.length - 1, index));
  if (target === active) {
    if (settle) settleActiveCard();
    return;
  }

  prepareCarouselMotion();
  cards.forEach(resetTilt);
  active = target;
  updateCarousel(false);

  if (settle) settleAfterMotion();
}

function goNext() {
  if (active < cards.length - 1) setProject(active + 1);
}

function goPrevious() {
  if (active > 0) setProject(active - 1);
}

function setCarouselSpeed(milliseconds) {
  carouselSpeed = milliseconds;
  document.documentElement.style.setProperty('--carousel-speed', milliseconds + 'ms');
}

function openImagePreview() {
  if (!imagePreview) return;
  resetHoveredTiltCard(false);
  imagePreview.classList.add('open');
  imagePreview.setAttribute('aria-hidden', 'false');
  document.body.classList.add('preview-open');
}

function closeImagePreview() {
  if (!imagePreview) return;
  imagePreview.classList.remove('open');
  imagePreview.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('preview-open');
}

function clearWheelMotion() {
  wheelAccumulator = 0;
  lastWheelAt = 0;
  lastWheelStepAt = 0;
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
    .map((card, index) => {
      const hit = cardContainsPointer(card, x, y);
      if (!hit) return null;

      const opacity = Number.parseFloat(card.style.opacity || '1');
      if (opacity < 0.08) return null;

      const centerX = hit.rect.left + hit.rect.width / 2;
      const centerDistance = Math.abs(x - centerX);

      return { ...hit, index, centerDistance, opacity };
    })
    .filter(Boolean);

  if (!candidates.length) return null;

  // Choose the card whose visible face center is nearest to the pointer.
  // This makes side cards independently hoverable/clickable even when
  // their transformed bounding boxes overlap the active card.
  candidates.sort((a, b) => {
    const centerDiff = a.centerDistance - b.centerDistance;
    if (Math.abs(centerDiff) > 1) return centerDiff;
    return b.opacity - a.opacity;
  });

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
  clearTiltResetTimer(card);
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
  lastWheelAt = now;
  wheelAccumulator += delta;

  const threshold = 82;
  const canStep = (now - lastWheelStepAt) >= 290;

  if (Math.abs(wheelAccumulator) >= threshold && canStep) {
    const direction = wheelAccumulator > 0 ? 1 : -1;
    const target = Math.max(0, Math.min(cards.length - 1, active + direction));

    wheelAccumulator = 0;
    lastWheelStepAt = now;

    if (target !== active) {
      setCarouselSpeed(320);
      setProject(target, false);
    }
  }

  if (wheelResetTimer) clearTimeout(wheelResetTimer);
  wheelResetTimer = window.setTimeout(() => {
    wheelAccumulator = 0;
    lastWheelAt = 0;
    lastWheelStepAt = 0;
    settleActiveCard();
    setCarouselSpeed(420);
  }, 360);
}, { passive: false });

carousel.addEventListener('pointerdown', (event) => {
  if (event.pointerType === 'mouse' && event.button !== 0) return;

  clearWheelMotion();

  const downHit = findVisualCardAtPointer(event.clientX, event.clientY);
  pointerDownCardIndex = downHit ? downHit.index : null;

  pointerStart = event.clientX;
  dragStartX = event.clientX;
  dragLastX = event.clientX;
  dragLastTime = performance.now();
  dragVelocity = 0;
  dragOffset = 0;
  dragMoved = false;
  isDragging = false;
  suppressClick = false;

  carousel.setPointerCapture?.(event.pointerId);
});

carousel.addEventListener('pointermove', (event) => {
  if (pointerStart === null) return;

  const now = performance.now();
  const dx = event.clientX - dragStartX;

  // Do not enter drag mode until the pointer has clearly moved.
  // This keeps a normal click on any side card as a click.
  if (!isDragging) {
    if (Math.abs(dx) < 10) return;

    isDragging = true;
    dragMoved = true;
    prepareCarouselMotion();
    resetHoveredTiltCard(false);
    cards.forEach((card) => resetTilt(card, false));
    setCarouselSpeed(0);
    carousel.classList.add('dragging');
  }

  const stepDx = event.clientX - dragLastX;
  const dt = Math.max(1, now - dragLastTime);

  dragVelocity = stepDx / dt;
  dragLastX = event.clientX;
  dragLastTime = now;
  dragOffset = dx;

  updateCarousel();
});

function finishPointerInteraction(event) {
  if (pointerStart === null) return;

  if (!isDragging) {
    const upHit = findVisualCardAtPointer(event.clientX, event.clientY);
    const clickedIndex =
      pointerDownCardIndex !== null && pointerDownCardIndex !== undefined
        ? pointerDownCardIndex
        : (upHit ? upHit.index : null);

    pointerStart = null;
    pointerDownCardIndex = null;
    dragOffset = 0;
    dragVelocity = 0;
    dragMoved = false;
    suppressClick = false;

    if (clickedIndex !== null && clickedIndex !== undefined) {
      if (clickedIndex === active && cards[clickedIndex]?.classList.contains('project-card--cover')) {
        openImagePreview();
      } else {
        setCarouselSpeed(360);
        setProject(clickedIndex);
        window.setTimeout(() => setCarouselSpeed(420), 380);
      }
    }

    try {
      carousel.releasePointerCapture?.(event.pointerId);
    } catch (_) {}

    return;
  }

  const spacing = getCardSpacing();
  const projected = dragOffset + dragVelocity * 150;

  let step = Math.round(-projected / spacing);

  if (step === 0 && Math.abs(dragOffset) > 70) {
    step = dragOffset < 0 ? 1 : -1;
  }

  step = Math.max(-2, Math.min(2, step));
  const target = Math.max(0, Math.min(cards.length - 1, active + step));

  isDragging = false;
  pointerStart = null;
  pointerDownCardIndex = null;
  dragOffset = 0;
  dragVelocity = 0;
  dragMoved = false;
  suppressClick = true;

  carousel.classList.remove('dragging');
  setCarouselSpeed(300);

  if (target !== active) {
    active = target;
  }

  updateCarousel(false);
  settleAfterMotion();

  window.setTimeout(() => {
    setCarouselSpeed(420);
    suppressClick = false;
  }, 320);

  try {
    carousel.releasePointerCapture?.(event.pointerId);
  } catch (_) {}
}

carousel.addEventListener('pointerup', finishPointerInteraction);
carousel.addEventListener('pointercancel', (event) => {
  if (pointerStart === null) return;

  isDragging = false;
  pointerStart = null;
  pointerDownCardIndex = null;
  dragOffset = 0;
  dragVelocity = 0;
  dragMoved = false;
  suppressClick = false;

  carousel.classList.remove('dragging');
  setCarouselSpeed(420);
  updateCarousel(true);

  try {
    carousel.releasePointerCapture?.(event.pointerId);
  } catch (_) {}
});

imagePreviewClose?.addEventListener('click', closeImagePreview);

document.querySelectorAll('[data-preview-close]').forEach((element) => {
  element.addEventListener('click', closeImagePreview);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && imagePreview?.classList.contains('open')) {
    closeImagePreview();
  }
});

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

window.addEventListener('resize', () => {
  cancelPendingSettle();
  updateCarousel(true);
});

updateCarousel(true);
