const photoInput = document.querySelector('#photoInput');
const canvas = document.querySelector('#previewCanvas');
const emptyState = document.querySelector('#emptyState');
const dropZone = document.querySelector('#dropZone');
const frameList = document.querySelector('#frameList');
const aspectRatio = document.querySelector('#aspectRatio');
const fitMode = document.querySelector('#fitMode');
const photoScale = document.querySelector('#photoScale');
const offsetX = document.querySelector('#offsetX');
const offsetY = document.querySelector('#offsetY');
const backgroundColor = document.querySelector('#backgroundColor');
const lineWidth = document.querySelector('#lineWidth');
const grain = document.querySelector('#grain');
const preserveResolution = document.querySelector('#preserveResolution');
const downloadJpg = document.querySelector('#downloadJpg');
const downloadPng = document.querySelector('#downloadPng');
const resetBtn = document.querySelector('#resetBtn');
const renderInfo = document.querySelector('#renderInfo');

const state = {
  photo: null,
  photoName: 'photo',
  frame: 'editorial-line',
  aspectRatio: '4:5',
  fitMode: 'contain',
  photoScale: 0.88,
  offsetX: 0,
  offsetY: 0,
  backgroundColor: '#ffffff',
  lineWidth: 4,
  grain: 0,
  seed: Math.floor(Math.random() * 1000000)
};

const frames = [
  { id: 'editorial-line', title: 'Editorial', note: 'белая подложка + чёрная линия' },
  { id: 'white-mat', title: 'White Mat', note: 'чистые белые поля' },
  { id: 'black-mat', title: 'Black Mat', note: 'чёрная подложка + светлая линия' },
  { id: 'instant-clean', title: 'Instant', note: 'увеличенное нижнее поле' },
  { id: 'torn-scan', title: 'Torn Scan', note: 'неровный чёрный край' },
  { id: 'none', title: 'Без рамки', note: 'только формат и масштаб' }
];

function seededRandom(seed) {
  let t = seed + 0x6D2B79F5;
  return function random() {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function renderFrameList() {
  frameList.innerHTML = '';

  frames.forEach((frame) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `frame-option ${state.frame === frame.id ? 'active' : ''}`;
    button.innerHTML = `${frame.title}<small>${frame.note}</small>`;

    button.addEventListener('click', () => {
      state.frame = frame.id;
      applyFrameDefaults(frame.id);
      state.seed = Math.floor(Math.random() * 1000000);
      renderFrameList();
      syncControls();
      drawPreview();
    });

    frameList.appendChild(button);
  });
}

function applyFrameDefaults(frameId) {
  if (frameId === 'editorial-line') {
    state.backgroundColor = '#ffffff';
    state.photoScale = 0.88;
    state.lineWidth = 4;
  }

  if (frameId === 'white-mat') {
    state.backgroundColor = '#ffffff';
    state.photoScale = 0.84;
    state.lineWidth = 0;
  }

  if (frameId === 'black-mat') {
    state.backgroundColor = '#111111';
    state.photoScale = 0.88;
    state.lineWidth = 4;
  }

  if (frameId === 'instant-clean') {
    state.backgroundColor = '#f2efe7';
    state.photoScale = 1;
    state.lineWidth = 0;
  }

  if (frameId === 'torn-scan') {
    state.backgroundColor = '#050505';
    state.photoScale = 0.96;
    state.lineWidth = 0;
  }
}

function loadFile(file) {
  if (!file || !file.type.startsWith('image/')) return;

  const reader = new FileReader();
  reader.onload = () => {
    const image = new Image();
    image.onload = () => {
      state.photo = image;
      state.photoName = file.name.replace(/\.[^.]+$/, '') || 'photo';
      state.seed = Math.floor(Math.random() * 1000000);
      emptyState.hidden = true;
      emptyState.style.display = 'none';
      downloadJpg.disabled = false;
      downloadPng.disabled = false;
      drawPreview();
    };
    image.onerror = () => window.alert('Не удалось открыть изображение. Попробуй JPG, PNG или WEBP.');
    image.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function parseAspect(value) {
  if (value === 'original') {
    if (!state.photo) return 4 / 5;
    return state.photo.naturalWidth / state.photo.naturalHeight;
  }

  const [width, height] = value.split(':').map(Number);
  return width / height;
}

function getOutputSize(forExport = false) {
  const ratio = parseAspect(state.aspectRatio);
  let longSide = 1800;

  if (forExport) {
    longSide = preserveResolution.checked && state.photo
      ? Math.min(7000, Math.max(state.photo.naturalWidth, state.photo.naturalHeight))
      : 2800;
  }

  if (ratio >= 1) {
    return {
      width: Math.round(longSide),
      height: Math.max(1, Math.round(longSide / ratio))
    };
  }

  return {
    width: Math.max(1, Math.round(longSide * ratio)),
    height: Math.round(longSide)
  };
}

function getPhotoLayout(width, height) {
  const imageWidth = state.photo.naturalWidth;
  const imageHeight = state.photo.naturalHeight;

  let area = { x: 0, y: 0, width, height };

  if (state.frame === 'instant-clean') {
    const side = Math.round(Math.min(width, height) * 0.065);
    const top = side;
    const bottom = Math.round(side * 2.7);
    area = {
      x: side,
      y: top,
      width: Math.max(1, width - side * 2),
      height: Math.max(1, height - top - bottom)
    };
  }

  const containScale = Math.min(area.width / imageWidth, area.height / imageHeight);
  const coverScale = Math.max(area.width / imageWidth, area.height / imageHeight);
  const baseScale = state.fitMode === 'cover' ? coverScale : containScale;
  const scale = baseScale * state.photoScale;

  const drawWidth = imageWidth * scale;
  const drawHeight = imageHeight * scale;
  const shiftX = state.offsetX * area.width * 0.0025;
  const shiftY = state.offsetY * area.height * 0.0025;

  return {
    x: area.x + (area.width - drawWidth) / 2 + shiftX,
    y: area.y + (area.height - drawHeight) / 2 + shiftY,
    width: drawWidth,
    height: drawHeight
  };
}

function render(targetCanvas, width, height) {
  const ctx = targetCanvas.getContext('2d', { willReadFrequently: true });
  targetCanvas.width = width;
  targetCanvas.height = height;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.clearRect(0, 0, width, height);

  ctx.fillStyle = state.backgroundColor;
  ctx.fillRect(0, 0, width, height);

  if (!state.photo) return;

  const rect = getPhotoLayout(width, height);
  ctx.drawImage(state.photo, rect.x, rect.y, rect.width, rect.height);

  if (state.grain > 0) drawGrain(ctx, width, height);

  if (state.frame === 'editorial-line' || state.frame === 'black-mat') {
    drawCleanLine(ctx, rect, width, height);
  }

  if (state.frame === 'torn-scan') {
    drawTornFrame(ctx, width, height);
  }
}

function drawCleanLine(ctx, rect, canvasWidth, canvasHeight) {
  if (state.lineWidth <= 0) return;

  const scale = Math.min(canvasWidth, canvasHeight) / 1800;
  const strokeWidth = Math.max(1, state.lineWidth * scale);
  const inset = strokeWidth / 2;

  ctx.save();
  ctx.strokeStyle = state.frame === 'black-mat' ? '#f4f2ec' : '#0a0a0a';
  ctx.lineWidth = strokeWidth;
  ctx.strokeRect(
    rect.x - inset,
    rect.y - inset,
    rect.width + strokeWidth,
    rect.height + strokeWidth
  );
  ctx.restore();
}

function createJaggedInset(length, base, random) {
  const step = Math.max(5, Math.round(length / 180));
  const points = [];
  let drift = 0;

  for (let position = 0; position <= length + step; position += step) {
    drift = drift * 0.72 + (random() - 0.5) * base * 0.28;
    const micro = (random() - 0.5) * base * 0.9;
    const bite = random() > 0.95 ? random() * base * 0.9 : 0;
    points.push({ position, depth: Math.max(base * 0.25, base + drift + micro + bite) });
  }

  return points;
}

function fillJaggedEdge(ctx, side, width, height, base, random) {
  const horizontal = side === 'top' || side === 'bottom';
  const points = createJaggedInset(horizontal ? width : height, base, random);

  ctx.beginPath();
  if (side === 'top') {
    ctx.moveTo(0, 0);
    ctx.lineTo(width, 0);
    for (let i = points.length - 1; i >= 0; i -= 1) ctx.lineTo(points[i].position, points[i].depth);
  }
  if (side === 'bottom') {
    ctx.moveTo(0, height);
    for (const point of points) ctx.lineTo(point.position, height - point.depth);
    ctx.lineTo(width, height);
  }
  if (side === 'left') {
    ctx.moveTo(0, 0);
    for (const point of points) ctx.lineTo(point.depth, point.position);
    ctx.lineTo(0, height);
  }
  if (side === 'right') {
    ctx.moveTo(width, 0);
    ctx.lineTo(width, height);
    for (let i = points.length - 1; i >= 0; i -= 1) ctx.lineTo(width - points[i].depth, points[i].position);
  }
  ctx.closePath();
  ctx.fill();
}

function drawTornFrame(ctx, width, height) {
  const random = seededRandom(state.seed);
  const base = Math.max(10, Math.round(Math.min(width, height) * 0.026));

  ctx.save();
  ctx.fillStyle = '#050505';
  fillJaggedEdge(ctx, 'top', width, height, base * 1.05, random);
  fillJaggedEdge(ctx, 'bottom', width, height, base * 1.15, random);
  fillJaggedEdge(ctx, 'left', width, height, base * 0.9, random);
  fillJaggedEdge(ctx, 'right', width, height, base * 1.1, random);
  ctx.restore();
}

function drawGrain(ctx, width, height) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const random = seededRandom(state.seed + 17);
  const strength = 28 * state.grain;

  for (let i = 0; i < data.length; i += 4) {
    const noise = (random() - 0.5) * strength;
    data[i] = Math.max(0, Math.min(255, data[i] + noise));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
  }

  ctx.putImageData(imageData, 0, 0);
}

function drawPreview() {
  if (!state.photo) return;

  const { width, height } = getOutputSize(false);
  render(canvas, width, height);

  const exportSize = getOutputSize(true);
  renderInfo.textContent = `Предпросмотр ${width} × ${height} px · экспорт ${exportSize.width} × ${exportSize.height} px`;
}

function syncControls() {
  aspectRatio.value = state.aspectRatio;
  fitMode.value = state.fitMode;
  photoScale.value = Math.round(state.photoScale * 100);
  offsetX.value = state.offsetX;
  offsetY.value = state.offsetY;
  backgroundColor.value = state.backgroundColor;
  lineWidth.value = state.lineWidth;
  grain.value = Math.round(state.grain * 100);

  document.querySelector('#photoScaleValue').textContent = `${photoScale.value}%`;
  document.querySelector('#offsetXValue').textContent = offsetX.value;
  document.querySelector('#offsetYValue').textContent = offsetY.value;
  document.querySelector('#lineWidthValue').textContent = `${lineWidth.value} px`;
  document.querySelector('#grainValue').textContent = `${grain.value}%`;

  document.querySelectorAll('.color-swatch').forEach((swatch) => {
    swatch.classList.toggle('active', swatch.dataset.color.toLowerCase() === state.backgroundColor.toLowerCase());
  });
}

function download(type) {
  if (!state.photo) return;

  const { width, height } = getOutputSize(true);
  const exportCanvas = document.createElement('canvas');
  render(exportCanvas, width, height);

  const extension = type === 'image/png' ? 'png' : 'jpg';
  const link = document.createElement('a');
  link.download = `${state.photoName}-frame.${extension}`;
  link.href = exportCanvas.toDataURL(type, type === 'image/jpeg' ? 0.95 : undefined);
  link.click();
}

function reset() {
  state.photo = null;
  state.photoName = 'photo';
  state.frame = 'editorial-line';
  state.aspectRatio = '4:5';
  state.fitMode = 'contain';
  state.photoScale = 0.88;
  state.offsetX = 0;
  state.offsetY = 0;
  state.backgroundColor = '#ffffff';
  state.lineWidth = 4;
  state.grain = 0;
  state.seed = Math.floor(Math.random() * 1000000);

  photoInput.value = '';
  preserveResolution.checked = true;
  canvas.width = 0;
  canvas.height = 0;
  emptyState.hidden = false;
  emptyState.style.display = '';
  downloadJpg.disabled = true;
  downloadPng.disabled = true;
  renderInfo.textContent = 'Фотография не отправляется на сервер.';

  syncControls();
  renderFrameList();
}

photoInput.addEventListener('change', (event) => loadFile(event.target.files[0]));

['dragenter', 'dragover'].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add('dragging');
  });
});

['dragleave', 'drop'].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove('dragging');
  });
});

dropZone.addEventListener('drop', (event) => loadFile(event.dataTransfer.files[0]));

aspectRatio.addEventListener('change', () => {
  state.aspectRatio = aspectRatio.value;
  drawPreview();
});

fitMode.addEventListener('change', () => {
  state.fitMode = fitMode.value;
  drawPreview();
});

photoScale.addEventListener('input', () => {
  state.photoScale = Number(photoScale.value) / 100;
  syncControls();
  drawPreview();
});

offsetX.addEventListener('input', () => {
  state.offsetX = Number(offsetX.value);
  syncControls();
  drawPreview();
});

offsetY.addEventListener('input', () => {
  state.offsetY = Number(offsetY.value);
  syncControls();
  drawPreview();
});

backgroundColor.addEventListener('input', () => {
  state.backgroundColor = backgroundColor.value;
  syncControls();
  drawPreview();
});

document.querySelectorAll('.color-swatch').forEach((swatch) => {
  swatch.addEventListener('click', () => {
    state.backgroundColor = swatch.dataset.color;
    syncControls();
    drawPreview();
  });
});

lineWidth.addEventListener('input', () => {
  state.lineWidth = Number(lineWidth.value);
  syncControls();
  drawPreview();
});

grain.addEventListener('input', () => {
  state.grain = Number(grain.value) / 100;
  syncControls();
  drawPreview();
});

preserveResolution.addEventListener('change', drawPreview);
downloadJpg.addEventListener('click', () => download('image/jpeg'));
downloadPng.addEventListener('click', () => download('image/png'));
resetBtn.addEventListener('click', reset);

renderFrameList();
syncControls();
