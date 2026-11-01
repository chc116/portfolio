const cards = [...document.querySelectorAll('.project-card')];
const selectors = [...document.querySelectorAll('.selector')];
const carousel = document.getElementById('carousel');
const previous = document.getElementById('previous');
const next = document.getElementById('next');
const projectNav = document.getElementById('projectNav');
const projectToggle = document.getElementById('projectToggle');

let active = 0;
let pointerStart = null;
let wheelAccumulator = 0;
let wheelResetTimer = null;
let lastWheelAt = 0;

function linearDistance(index, current) {
  return index - current;
}

function updateCarousel() {
  const total = cards.length;
  const spacing = window.innerWidth <= 760
    ? Math.min(window.innerWidth * 0.78, 330)
    : Math.min(Math.max(window.innerWidth * 0.36, 520), 640);

  cards.forEach((card, index) => {
    const distance = linearDistance(index, active);
    const depth = Math.abs(distance);

    let x = distance * spacing;
    if (depth > 1) x *= 1.05;

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

function resetTilt(card) {
  const surface = card.querySelector('.card-surface');
  card.classList.remove('pointer-tilt');
  if (!surface) return;
  surface.style.setProperty('--tilt-x', '0deg');
  surface.style.setProperty('--tilt-y', '0deg');
  surface.style.setProperty('--pointer-x', '50%');
  surface.style.setProperty('--pointer-y', '50%');
  surface.style.setProperty('--shift-x', '0px');
  surface.style.setProperty('--shift-y', '0px');
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
  card.addEventListener('click', () => {
    clearWheelMotion();
    if (index !== active) setProject(index);
  });
});

let tiltFrame = null;

cards.forEach((card, index) => {
  const surface = card.querySelector('.card-surface');
  if (!surface) return;

  card.addEventListener('pointermove', (event) => {
    if (index !== active || event.pointerType === 'touch') return;

    const rect = surface.getBoundingClientRect();
    const px = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const py = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));

    const maxTiltX = 9;
    const maxTiltY = 12;
    const tiltY = (px - 0.5) * maxTiltY * 2;
    const tiltX = (0.5 - py) * maxTiltX * 2;
    const shiftX = (px - 0.5) * 18;
    const shiftY = (py - 0.5) * 12;

    if (tiltFrame) cancelAnimationFrame(tiltFrame);
    tiltFrame = requestAnimationFrame(() => {
      card.classList.add('pointer-tilt');
      surface.style.setProperty('--tilt-x', tiltX.toFixed(2) + 'deg');
      surface.style.setProperty('--tilt-y', tiltY.toFixed(2) + 'deg');
      surface.style.setProperty('--pointer-x', (px * 100).toFixed(1) + '%');
      surface.style.setProperty('--pointer-y', (py * 100).toFixed(1) + '%');
      surface.style.setProperty('--shift-x', shiftX.toFixed(2) + 'px');
      surface.style.setProperty('--shift-y', shiftY.toFixed(2) + 'px');
    });
  });

  card.addEventListener('pointerleave', () => {
    if (tiltFrame) {
      cancelAnimationFrame(tiltFrame);
      tiltFrame = null;
    }
    resetTilt(card);
  });
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
  clearWheelMotion();
  pointerStart = event.clientX;
  carousel.setPointerCapture?.(event.pointerId);
});

carousel.addEventListener('pointerup', (event) => {
  if (pointerStart === null) return;
  const movement = event.clientX - pointerStart;
  if (movement > 55) goPrevious();
  if (movement < -55) goNext();
  pointerStart = null;
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

window.addEventListener('resize', updateCarousel);

updateCarousel();
