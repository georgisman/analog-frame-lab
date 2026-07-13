const photoInput = document.querySelector('#photoInput');
const canvas = document.querySelector('#previewCanvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const emptyState = document.querySelector('#emptyState');
const dropZone = document.querySelector('#dropZone');
const frameList = document.querySelector('#frameList');
const frameScale = document.querySelector('#frameScale');
const frameOpacity = document.querySelector('#frameOpacity');
const grain = document.querySelector('#grain');
const preserveRatio = document.querySelector('#preserveRatio');
const downloadJpg = document.querySelector('#downloadJpg');
const downloadPng = document.querySelector('#downloadPng');
const resetBtn = document.querySelector('#resetBtn');

const state = {
  photo: null,
  photoName: 'photo',
  frame: 'torn-scan',
  frameScale: 1,
  frameOpacity: 1,
  grain: 0.08,
  seed: Math.floor(Math.random() * 1000000)
};

const frames = [
  { id: 'torn-scan', title: 'Torn Scan', note: 'рваный край скана' },
  { id: 'dirty-negative', title: 'Dirty 35', note: 'грязь и царапины' },
  { id: 'burned-edge', title: 'Burned 120', note: 'тёплая засветка' },
  { id: 'instant-aged', title: 'Aged Instant', note: 'старая белая рамка' },
  { id: 'none', title: 'Без рамки', note: 'только зерно' }
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
      state.seed = Math.floor(Math.random() * 1000000);
      renderFrameList();
      draw();
    });

    frameList.appendChild(button);
  });
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
      draw();
    };

    image.src = reader.result;
  };

  reader.readAsDataURL(file);
}

function setCanvasSize(image) {
  const maxSide = preserveRatio.checked ? Infinity : 2800;
  const ratio = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));

  canvas.width = Math.round(image.naturalWidth * ratio);
  canvas.height = Math.round(image.naturalHeight * ratio);
}

function draw() {
  if (!state.photo) return;

  setCanvasSize(state.photo);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(state.photo, 0, 0, canvas.width, canvas.height);

  drawGrain();
  drawFrame();
}

function drawGrain() {
  if (state.grain <= 0) return;

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const random = seededRandom(state.seed + 17);
  const strength = 34 * state.grain;

  for (let i = 0; i < data.length; i += 4) {
    const noise = (random() - 0.5) * strength;
    data[i] += noise;
    data[i + 1] += noise;
    data[i + 2] += noise;
  }

  ctx.putImageData(imageData, 0, 0);
}

function createJaggedInset(side, base, random, roughness = 0.75) {
  const w = canvas.width;
  const h = canvas.height;
  const horizontal = side === 'top' || side === 'bottom';
  const length = horizontal ? w : h;
  const step = Math.max(5, Math.round(length / 180));
  const points = [];

  let drift = 0;

  for (let position = 0; position <= length + step; position += step) {
    drift = drift * 0.72 + (random() - 0.5) * base * 0.28;
    const micro = (random() - 0.5) * base * roughness;
    const bite = random() > 0.94 ? random() * base * 0.9 : 0;
    const depth = Math.max(base * 0.28, base + drift + micro + bite);
    points.push({ position, depth });
  }

  return points;
}

function fillJaggedEdge(side, base, fillStyle, random, roughness = 0.75) {
  const w = canvas.width;
  const h = canvas.height;
  const points = createJaggedInset(side, base, random, roughness);

  ctx.fillStyle = fillStyle;
  ctx.beginPath();

  if (side === 'top') {
    ctx.moveTo(0, 0);
    ctx.lineTo(w, 0);
    for (let i = points.length - 1; i >= 0; i--) {
      ctx.lineTo(points[i].position, points[i].depth);
    }
  }

  if (side === 'bottom') {
    ctx.moveTo(0, h);
    for (const point of points) {
      ctx.lineTo(point.position, h - point.depth);
    }
    ctx.lineTo(w, h);
  }

  if (side === 'left') {
    ctx.moveTo(0, 0);
    for (const point of points) {
      ctx.lineTo(point.depth, point.position);
    }
    ctx.lineTo(0, h);
  }

  if (side === 'right') {
    ctx.moveTo(w, 0);
    ctx.lineTo(w, h);
    for (let i = points.length - 1; i >= 0; i--) {
      ctx.lineTo(w - points[i].depth, points[i].position);
    }
  }

  ctx.closePath();
  ctx.fill();
}

function addDust(random, amount, light = false) {
  const w = canvas.width;
  const h = canvas.height;

  ctx.save();

  for (let i = 0; i < amount; i++) {
    const x = random() * w;
    const y = random() * h;
    const radius = Math.max(0.4, random() * Math.min(w, h) * 0.0025);
    const alpha = 0.05 + random() * 0.22;

    ctx.fillStyle = light
      ? `rgba(255,245,220,${alpha})`
      : `rgba(0,0,0,${alpha})`;

    ctx.beginPath();
    ctx.ellipse(x, y, radius * (0.4 + random()), radius, random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function addScratches(random, amount) {
  const w = canvas.width;
  const h = canvas.height;

  ctx.save();
  ctx.lineCap = 'round';

  for (let i = 0; i < amount; i++) {
    const x = random() * w;
    const y = random() * h;
    const length = h * (0.03 + random() * 0.25);
    const bend = (random() - 0.5) * w * 0.018;

    ctx.strokeStyle = `rgba(255,245,225,${0.04 + random() * 0.13})`;
    ctx.lineWidth = Math.max(0.45, Math.min(w, h) * (0.00025 + random() * 0.0005));

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + bend, y + length * 0.5, x + bend * 0.35, y + length);
    ctx.stroke();
  }

  ctx.restore();
}

function addEdgeFog(random, warm = false) {
  const w = canvas.width;
  const h = canvas.height;
  const radius = Math.max(w, h) * 0.42;

  for (let i = 0; i < 4; i++) {
    const side = Math.floor(random() * 4);
    const x = side === 1 ? w : side === 3 ? 0 : random() * w;
    const y = side === 0 ? 0 : side === 2 ? h : random() * h;

    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, warm ? 'rgba(255,85,22,.22)' : 'rgba(255,230,190,.13)');
    gradient.addColorStop(0.45, warm ? 'rgba(210,30,0,.07)' : 'rgba(255,220,180,.035)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  }
}

function drawFrame() {
  if (state.frame === 'none') return;

  const w = canvas.width;
  const h = canvas.height;
  const base = Math.max(12, Math.round(Math.min(w, h) * 0.032 * state.frameScale));
  const random = seededRandom(state.seed);

  ctx.save();
  ctx.globalAlpha = state.frameOpacity;

  if (state.frame === 'torn-scan') {
    const black = '#050505';

    fillJaggedEdge('top', base * 1.05, black, random, 0.95);
    fillJaggedEdge('bottom', base * 1.15, black, random, 1);
    fillJaggedEdge('left', base * 0.9, black, random, 0.85);
    fillJaggedEdge('right', base * 1.1, black, random, 0.9);

    addDust(random, 150, true);
    addScratches(random, 13);
  }

  if (state.frame === 'dirty-negative') {
    const darkBrown = '#120906';

    fillJaggedEdge('top', base * 1.15, darkBrown, random, 0.72);
    fillJaggedEdge('bottom', base * 1.2, darkBrown, random, 0.76);
    fillJaggedEdge('left', base * 0.82, darkBrown, random, 0.7);
    fillJaggedEdge('right', base * 0.9, darkBrown, random, 0.7);

    ctx.fillStyle = 'rgba(255,170,75,.58)';
    ctx.font = `${Math.max(10, base * 0.34)}px monospace`;
    ctx.fillText('35  12A  KODAK', base * 1.2, h - base * 0.42);

    addDust(random, 260, false);
    addDust(random, 75, true);
    addScratches(random, 28);
  }

  if (state.frame === 'burned-edge') {
    const burned = '#180805';

    fillJaggedEdge('top', base * 1.22, burned, random, 0.88);
    fillJaggedEdge('bottom', base * 1.28, burned, random, 0.92);
    fillJaggedEdge('left', base * 0.96, burned, random, 0.82);
    fillJaggedEdge('right', base * 1.12, burned, random, 0.82);

    addEdgeFog(random, true);
    addDust(random, 120, true);
    addScratches(random, 10);
  }

  if (state.frame === 'instant-aged') {
    const side = base * 1.35;
    const bottom = base * 3.1;
    const paper = '#e8e1d1';

    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, w, side);
    ctx.fillRect(0, h - bottom, w, bottom);
    ctx.fillRect(0, 0, side, h);
    ctx.fillRect(w - side, 0, side, h);

    ctx.globalCompositeOperation = 'multiply';
    addDust(random, 180, false);

    const stain = ctx.createRadialGradient(w * 0.08, h * 0.95, 0, w * 0.08, h * 0.95, w * 0.32);
    stain.addColorStop(0, 'rgba(115,70,25,.16)');
    stain.addColorStop(1, 'rgba(115,70,25,0)');
    ctx.fillStyle = stain;
    ctx.fillRect(0, 0, w, h);
  }

  ctx.restore();
}

function download(type) {
  if (!state.photo) return;

  draw();

  const link = document.createElement('a');
  link.download = `${state.photoName}-analog-frame.${type === 'image/png' ? 'png' : 'jpg'}`;
  link.href = canvas.toDataURL(type, type === 'image/jpeg' ? 0.94 : undefined);
  link.click();
}

function reset() {
  state.photo = null;
  state.photoName = 'photo';
  state.frame = 'torn-scan';
  state.frameScale = 1;
  state.frameOpacity = 1;
  state.grain = 0.08;
  state.seed = Math.floor(Math.random() * 1000000);

  photoInput.value = '';
  frameScale.value = 100;
  frameOpacity.value = 100;
  grain.value = 8;
  preserveRatio.checked = true;

  canvas.width = 0;
  canvas.height = 0;

  emptyState.hidden = false;
  emptyState.style.display = '';

  downloadJpg.disabled = true;
  downloadPng.disabled = true;

  syncLabels();
  renderFrameList();
}

function syncLabels() {
  document.querySelector('#frameScaleValue').textContent = `${frameScale.value}%`;
  document.querySelector('#frameOpacityValue').textContent = `${frameOpacity.value}%`;
  document.querySelector('#grainValue').textContent = `${grain.value}%`;
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

frameScale.addEventListener('input', () => {
  state.frameScale = Number(frameScale.value) / 100;
  syncLabels();
  draw();
});

frameOpacity.addEventListener('input', () => {
  state.frameOpacity = Number(frameOpacity.value) / 100;
  syncLabels();
  draw();
});

grain.addEventListener('input', () => {
  state.grain = Number(grain.value) / 100;
  syncLabels();
  draw();
});

preserveRatio.addEventListener('change', draw);
downloadJpg.addEventListener('click', () => download('image/jpeg'));
downloadPng.addEventListener('click', () => download('image/png'));
resetBtn.addEventListener('click', reset);

renderFrameList();
syncLabels();
