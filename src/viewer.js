import '@google/model-viewer';

/**
 * Construye el <model-viewer> con el modelo 3D, AR para iPhone y los hotspots
 * de anotación. Devuelve el elemento ya configurado.
 *
 * @param {object} data        Datos de la propiedad (ver data.json)
 * @param {string} baseUrl     URL base donde viven los archivos del modelo
 * @returns {HTMLElement}      Elemento <model-viewer>
 */
export function createViewer(data, baseUrl) {
  const mv = document.createElement('model-viewer');

  mv.setAttribute('src', resolveUrl(data.model, baseUrl));
  if (data.iosModel) {
    // Quick Look (AR nativo) en iPhone/iPad usa el .usdz.
    mv.setAttribute('ios-src', resolveUrl(data.iosModel, baseUrl));
    mv.setAttribute('ar', '');
    mv.setAttribute('ar-modes', 'webxr scene-viewer quick-look');
  }

  mv.setAttribute('alt', data.title || 'Modelo 3D de la propiedad');
  mv.setAttribute('camera-controls', '');
  mv.setAttribute('touch-action', 'pan-y');
  mv.setAttribute('shadow-intensity', '1');
  mv.setAttribute('exposure', '1');
  mv.setAttribute('environment-image', 'neutral');
  mv.setAttribute('loading', 'eager');
  mv.setAttribute('camera-orbit', '45deg 70deg auto');

  // Botón AR (slot nativo de model-viewer)
  if (data.iosModel) {
    const arButton = document.createElement('button');
    arButton.slot = 'ar-button';
    arButton.className = 'ar-button';
    arButton.textContent = 'Ver en tu espacio (AR)';
    mv.appendChild(arButton);
  }

  addAnnotations(mv, data.annotations || []);

  return mv;
}

/**
 * Agrega cada anotación como un hotspot posicionado en el espacio 3D.
 * model-viewer ancla los slots "hotspot-*" usando data-position / data-normal.
 */
function addAnnotations(mv, annotations) {
  annotations.forEach((a, i) => {
    const btn = document.createElement('button');
    btn.className = 'hotspot';
    btn.slot = `hotspot-${i}`;
    btn.dataset.position = a.position;
    if (a.normal) btn.dataset.normal = a.normal;
    btn.setAttribute('aria-label', a.label || `Anotación ${i + 1}`);

    const label = document.createElement('div');
    label.className = 'annotation';
    label.textContent = a.label || `Anotación ${i + 1}`;
    btn.appendChild(label);

    // Toggle de la etiqueta al tocar (además del hover en desktop).
    btn.addEventListener('click', () => {
      const open = btn.dataset.open === 'true';
      btn.dataset.open = open ? 'false' : 'true';
    });

    mv.appendChild(btn);
  });
}

/** Resuelve una ruta relativa contra la baseUrl; respeta URLs absolutas. */
function resolveUrl(path, baseUrl) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${baseUrl.replace(/\/$/, '')}/${path}`;
}
