const cards = [...document.querySelectorAll('.project-card')];
const selectors = [...document.querySelectorAll('.selector')];
const carousel = document.getElementById('carousel');
const previous = document.getElementById('previous');
const next = document.getElementById('next');
const projectNav = document.getElementById('projectNav');
const projectToggle = document.getElementById('projectToggle');

let active = 0;
let pointerStart = null;
let wheelLocked = false;

function circularDistance(index, current, total) {
  let distance = index - current;
  if (distance > total / 2) distance -= total;
  if (distance < -total / 2) distance += total;
  return distance;
}

function updateCarousel() {
  const total = cards.length;
  const spacing = Math.min(window.innerWidth * 0.29, 350);

  cards.forEach((card, index) => {
    const distance = circularDistance(index, active, total);
    const depth = Math.abs(distance);

    let x = distance * spacing;
    if (depth > 1) x *= 1.05;

    const z = -depth * 220;
    const rotateY = distance * -19;
    const scale = 1 - depth * 0.105;

    card.style.transform =
      `translate(-50%, -50%) translate3d(${x}px, 0, ${z}px) rotateY(${rotateY}deg) scale(${scale})`;
    card.style.zIndex = String(20 - depth);
    card.style.opacity = depth === 0 ? '1' : depth === 1 ? '.43' : '.12';
    card.style.filter = depth === 0 ? 'none' : `brightness(${Math.max(.48, 1 - depth * .23)})`;
    card.classList.toggle('active', index === active);
  });

  selectors.forEach((selector, index) => {
    selector.classList.toggle('active', index === active);
  });
}

function setProject(index) {
  active = (index + cards.length) % cards.length;
  updateCarousel();
}

function goNext() { setProject(active + 1); }
function goPrevious() { setProject(active - 1); }

next.addEventListener('click', goNext);
previous.addEventListener('click', goPrevious);

selectors.forEach((selector) => {
  selector.addEventListener('click', () => setProject(Number(selector.dataset.select)));
});

cards.forEach((card, index) => {
  card.addEventListener('click', () => {
    if (index !== active) setProject(index);
  });
});

carousel.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowRight') goNext();
  if (event.key === 'ArrowLeft') goPrevious();
});

carousel.addEventListener('wheel', (event) => {
  if (wheelLocked || Math.abs(event.deltaY) < 8) return;
  wheelLocked = true;
  event.deltaY > 0 ? goNext() : goPrevious();
  window.setTimeout(() => { wheelLocked = false; }, 460);
}, { passive: true });

carousel.addEventListener('pointerdown', (event) => {
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
