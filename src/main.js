import { createViewer } from './viewer.js';
import { renderMinimap } from './minimap.js';

const app = document.getElementById('app');
const statusEl = document.getElementById('status');
const view3d = document.getElementById('view-3d');
const view2d = document.getElementById('view-2d');
const toggleBtn = document.getElementById('toggle-mode');

/**
 * Resuelve de dónde cargar la propiedad:
 *  - ?src=<url>  → URL directa a un data.json (o carpeta que lo contenga)
 *  - ?id=<slug>  → carpeta ./propiedades/<slug>/data.json (convención por defecto)
 * Por defecto carga la propiedad demo incluida en el repo.
 */
function resolveSource() {
  const params = new URLSearchParams(window.location.search);
  const src = params.get('src');
  const id = params.get('id') || 'demo';

  if (src) {
    const base = src.replace(/\/data\.json$/i, '');
    const dataUrl = /data\.json$/i.test(src) ? src : `${base.replace(/\/$/, '')}/data.json`;
    return { dataUrl, baseUrl: base.replace(/\/$/, '') };
  }

  // Convención local: la demo vive en public/demo, el resto en propiedades/<id>.
  const baseUrl = id === 'demo' ? 'demo' : `propiedades/${id}`;
  return { dataUrl: `${baseUrl}/data.json`, baseUrl };
}

function showError(message) {
  statusEl.hidden = false;
  statusEl.classList.add('error');
  statusEl.textContent = message;
}

function setMode(mode) {
  app.dataset.mode = mode;
  const is2d = mode === '2d';
  view3d.hidden = is2d;
  view2d.hidden = !is2d;
  toggleBtn.textContent = is2d ? 'Ver en 3D' : 'Ver planta 2D';
  toggleBtn.setAttribute('aria-pressed', String(is2d));
}

async function init() {
  const { dataUrl, baseUrl } = resolveSource();

  let data;
  try {
    const res = await fetch(dataUrl, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (err) {
    showError(`No se pudo cargar la propiedad (${dataUrl}). ${err.message}`);
    return;
  }

  // 3D
  try {
    const viewer = createViewer(data, baseUrl);
    viewer.addEventListener('load', () => {
      statusEl.hidden = true;
    });
    viewer.addEventListener('error', () => {
      showError('No se pudo cargar el modelo 3D.');
    });
    view3d.appendChild(viewer);
  } catch (err) {
    showError(`Error al iniciar el visor 3D: ${err.message}`);
    return;
  }

  // 2D
  renderMinimap(data, baseUrl);

  // Toggle
  toggleBtn.addEventListener('click', () => {
    setMode(app.dataset.mode === '2d' ? '3d' : '2d');
  });

  setMode('3d');
}

init();
