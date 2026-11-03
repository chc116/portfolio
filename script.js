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
    top
  };
}

function prepareCarouselMotion() {
  
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

function updateCarousel() {
  cards.forEach((card, index) => {
    const layout = getCardLayout(index);
    const { depth } = layout;

    card.style.left = layout.left + 'px';
    card.style.top = layout.top + 'px';
    card.style.transform = 'none';
    card.style.zIndex = String(20 - depth);
    card.style.opacity = depth === 0 ? '1' : depth === 1 ? '.68' : depth === 2 ? '.24' : '.08';
    card.style.filter = 'none';
    card.classList.toggle('active', index === active);
  });

  updateTimelineRange(active);

  previous.disabled = active === 0;
  next.disabled = active === cards.length - 1;
}

function setProject(index) {
  const target = Math.max(0, Math.min(cards.length - 1, index));
  if (target === active) return;

  
  active = target;
  updateCarousel();
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

let hoveredCard = null;

function clearHoveredCard() {
  if (!hoveredCard) return;
  hoveredCard.classList.remove('hovered');
  hoveredCard = null;
}

carousel.addEventListener('pointermove', (event) => {
  if (isDragging || event.pointerType === 'touch') return;

  const hit = findVisualCardAtPointer(event.clientX, event.clientY);
  const nextCard = hit ? hit.card : null;

  if (hoveredCard && hoveredCard !== nextCard) {
    hoveredCard.classList.remove('hovered');
  }

  hoveredCard = nextCard;
  hoveredCard?.classList.add('hovered');
});

carousel.addEventListener('pointerleave', clearHoveredCard);
window.addEventListener('blur', clearHoveredCard);

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
      setProject(target)
    }
  }

  if (wheelResetTimer) clearTimeout(wheelResetTimer);
  wheelResetTimer = window.setTimeout(() => {
    wheelAccumulator = 0;
    lastWheelAt = 0;
    lastWheelStepAt = 0;
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
        setProject(clickedIndex)
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

  updateCarousel();

  window.setTimeout(() => {
    setCarouselSpeed(420);
    suppressClick = false;
  }, 220);

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
  updateCarousel();

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
  
  updateCarousel();
});

updateCarousel(true);
