/**
 * Renderiza la vista 2D: imagen de planta + lista de habitaciones con metros.
 * En el MVP la planta es la imagen exportada por la app de escaneo.
 *
 * @param {object} data     Datos de la propiedad
 * @param {string} baseUrl  URL base de los archivos
 */
export function renderMinimap(data, baseUrl) {
  const img = document.getElementById('floorplan');
  const title = document.getElementById('property-title');
  const list = document.getElementById('rooms-list');

  if (data.floorplan) {
    img.src = resolveUrl(data.floorplan, baseUrl);
    img.hidden = false;
  } else {
    img.hidden = true;
  }

  title.textContent = data.title || '';

  list.innerHTML = '';
  const rooms = data.rooms || [];
  if (rooms.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'Sin habitaciones registradas';
    list.appendChild(li);
    return;
  }

  rooms.forEach((room) => {
    const li = document.createElement('li');

    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = room.name || 'Habitación';

    const area = document.createElement('span');
    area.className = 'area';
    area.textContent = room.area != null ? `${room.area} m²` : '';

    li.append(name, area);
    list.appendChild(li);
  });
}

function resolveUrl(path, baseUrl) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${baseUrl.replace(/\/$/, '')}/${path}`;
}
