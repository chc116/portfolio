const STORAGE_KEY = 'yechen-portfolio-content-v1';
const THEME_KEY = 'yechen-portfolio-theme-v1';

const editableNodes = [...document.querySelectorAll('[data-editable]')];
const editToggle = document.getElementById('editToggle');
const editPanel = document.getElementById('editPanel');
const closeEditor = document.getElementById('closeEditor');
const resetContent = document.getElementById('resetContent');
const exportContent = document.getElementById('exportContent');
const themeToggle = document.getElementById('themeToggle');

const defaults = {};
editableNodes.forEach(node => {
  defaults[node.dataset.key] = node.innerHTML.trim();
});

function getSavedContent() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch { return {}; }
}

function hydrateContent() {
  const saved = getSavedContent();
  editableNodes.forEach(node => {
    const key = node.dataset.key;
    if (saved[key] !== undefined) node.innerHTML = saved[key];
  });
}

function saveNode(node) {
  const saved = getSavedContent();
  saved[node.dataset.key] = node.innerHTML.trim();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
}

function setEditing(enabled) {
  document.body.classList.toggle('editing', enabled);
  editPanel.classList.toggle('open', enabled);
  editPanel.setAttribute('aria-hidden', String(!enabled));
  editableNodes.forEach(node => node.setAttribute('contenteditable', String(enabled)));
  if (editToggle) editToggle.textContent = enabled ? 'Editing…' : 'Edit content';
}

editableNodes.forEach(node => {
  node.addEventListener('input', () => saveNode(node));
  node.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey && node.tagName !== 'P') {
      e.preventDefault();
      node.blur();
    }
  });
});

if (editToggle) editToggle.addEventListener('click', () => setEditing(!document.body.classList.contains('editing')));
closeEditor.addEventListener('click', () => setEditing(false));

resetContent.addEventListener('click', () => {
  if (!confirm('Reset all edited text to the original demo content?')) return;
  localStorage.removeItem(STORAGE_KEY);
  editableNodes.forEach(node => node.innerHTML = defaults[node.dataset.key]);
});

exportContent.addEventListener('click', () => {
  const payload = { ...defaults, ...getSavedContent() };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'portfolio-content.json';
  a.click();
  URL.revokeObjectURL(url);
});

function applyTheme(theme) {
  document.body.classList.toggle('dark', theme === 'dark');
  localStorage.setItem(THEME_KEY, theme);
}

const initialTheme = localStorage.getItem(THEME_KEY) || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
applyTheme(initialTheme);
themeToggle.addEventListener('click', () => applyTheme(document.body.classList.contains('dark') ? 'light' : 'dark'));

document.getElementById('year').textContent = new Date().getFullYear();

const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

const modal = document.getElementById('projectModal');
const modalTitle = document.getElementById('modalTitle');
const modalText = document.getElementById('modalText');
const modalKicker = document.getElementById('modalKicker');

const projectCopy = {
  1: {
    kicker: 'RESEARCH CASE STUDY',
    title: 'Sparse Online Gaussian Processes for Fluid Antenna Systems',
    text: 'This page can later show the research problem, mathematical formulation, sequential update, fixed-budget basis selection, position selection, MATLAB implementation, and experimental results. For now it remains intentionally short so the visual structure can be refined first.'
  },
  2: {
    kicker: 'ENGINEERING CASE STUDY',
    title: 'Real-Time Browser Video Calling',
    text: 'This page can later document the path from AI enhancement experiments to the decision to prioritise stable WebRTC communication, including browser constraints, ONNX Runtime experiments, cross-region testing and latency trade-offs.'
  },
  3: {
    kicker: 'LEADERSHIP CASE STUDY',
    title: 'Swim Training Design & Multi-Lane Coaching',
    text: 'This page can later show how training sessions are structured across six lanes, how time cycles are used to coordinate rest, and how CSS, RPE, heart rate and technical drills inform coaching decisions.'
  }
};

function openProject(id) {
  const data = projectCopy[id];
  if (!data) return;
  modalKicker.textContent = data.kicker;
  modalTitle.textContent = data.title;
  modalText.textContent = data.text;
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
}
function closeProject() {
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
}

document.querySelectorAll('[data-project]').forEach(btn => btn.addEventListener('click', () => openProject(btn.dataset.project)));
document.querySelectorAll('[data-close-modal]').forEach(el => el.addEventListener('click', closeProject));
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeProject(); });

hydrateContent();
