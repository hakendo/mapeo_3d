import { createViewer } from './viewer.js';
import { renderMinimap } from './minimap.js';
import { createFirstPerson } from './firstperson.js';

const app = document.getElementById('app');
const statusEl = document.getElementById('status');
const view3d = document.getElementById('view-3d');
const viewFp = document.getElementById('view-fp');
const view2d = document.getElementById('view-2d');
const modeButtons = Array.from(document.querySelectorAll('.controls [data-mode]'));

/**
 * Resuelve de dónde cargar la propiedad:
 *  - ?src=<url>  → URL directa a un data.json (o carpeta que lo contenga)
 *  - ?id=<slug>  → carpeta ./propiedades/<slug>/data.json (convención por defecto)
 * Por defecto carga la propiedad demo incluida en el repo.
 */
function resolveSource() {
  const params = new URLSearchParams(window.location.search);
  const src = params.get('src');

  // Saneo del id: solo el slug, sin barras, query ni fragmentos.
  const rawId = params.get('id') || 'demo';
  const id = rawId.split(/[/?#]/)[0] || 'demo';

  if (src) {
    // src puede apuntar al data.json directo o a la carpeta que lo contiene.
    const hasFile = /data\.json$/i.test(src);
    const baseAbs = new URL(hasFile ? src.replace(/data\.json$/i, '') : `${src.replace(/\/$/, '')}/`, window.location.href);
    const dataUrl = new URL('data.json', baseAbs).href;
    return { dataUrl, baseUrl: baseAbs.href };
  }

  // Convención: la demo vive en ./demo, el resto en ./propiedades/<id>.
  const baseRel = id === 'demo' ? 'demo/' : `propiedades/${encodeURIComponent(id)}/`;
  // Resolución absoluta contra la ubicación actual (robusta en subrutas como /mapeo_3d/).
  const baseAbs = new URL(baseRel, window.location.href);
  const dataUrl = new URL('data.json', baseAbs).href;
  return { dataUrl, baseUrl: baseAbs.href };
}

function showError(message) {
  statusEl.hidden = false;
  statusEl.classList.add('error');
  statusEl.textContent = message;
}

// Recorrido en primera persona: se inicializa de forma diferida la primera vez.
let fpController = null;
let fpModelUrl = null;
let fpLoading = false;

async function ensureFirstPerson() {
  if (fpController || fpLoading || !fpModelUrl) return;
  fpLoading = true;
  try {
    fpController = await createFirstPerson(viewFp, fpModelUrl);
  } catch (err) {
    showError(`No se pudo iniciar el recorrido: ${err.message}`);
  } finally {
    fpLoading = false;
  }
}

function setMode(mode) {
  app.dataset.mode = mode;
  view3d.hidden = mode !== 'orbit';
  viewFp.hidden = mode !== 'fp';
  view2d.hidden = mode !== '2d';

  modeButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));

  if (mode === 'fp') {
    ensureFirstPerson().then(() => fpController && fpController.start());
  } else if (fpController) {
    fpController.stop();
  }
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

  // URL del modelo para el recorrido en primera persona
  fpModelUrl = /^https?:\/\//i.test(data.model) ? data.model : new URL(data.model, baseUrl).href;

  // 3D orbital
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

  // Selector de modo
  modeButtons.forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));

  setMode('orbit');
}

init();
