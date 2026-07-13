const photoInput = document.querySelector('#photoInput');
const canvas = document.querySelector('#previewCanvas');
const ctx = canvas.getContext('2d');
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
  frame: 'classic-black',
  frameScale: 1,
  frameOpacity: 1,
  grain: 0.08
};

const frames = [
  { id: 'classic-black', title: 'Classic 35', note: 'чёрная кромка' },
  { id: 'warm-negative', title: 'Warm 120', note: 'тёплый негатив' },
  { id: 'rough-scan', title: 'Rough Scan', note: 'неровный скан' },
  { id: 'white-polaroid', title: 'Instant', note: 'белая рамка' },
  { id: 'none', title: 'Без рамки', note: 'только зерно' }
];

function renderFrameList() {
  frameList.innerHTML = '';
  frames.forEach((frame) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `frame-option ${state.frame === frame.id ? 'active' : ''}`;
    button.innerHTML = `${frame.title}<small>${frame.note}</small>`;
    button.addEventListener('click', () => {
      state.frame = frame.id;
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
      emptyState.hidden = true;
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
  const strength = 28 * state.grain;

  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * strength;
    data[i] += noise;
    data[i + 1] += noise;
    data[i + 2] += noise;
  }

  ctx.putImageData(imageData, 0, 0);
}

function drawFrame() {
  if (state.frame === 'none') return;

  const w = canvas.width;
  const h = canvas.height;
  const base = Math.max(10, Math.round(Math.min(w, h) * 0.035 * state.frameScale));

  ctx.save();
  ctx.globalAlpha = state.frameOpacity;

  if (state.frame === 'classic-black') {
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, w, base);
    ctx.fillRect(0, h - base, w, base);
    ctx.fillRect(0, 0, base, h);
    ctx.fillRect(w - base, 0, base, h);

    ctx.fillStyle = 'rgba(255,255,255,.15)';
    for (let i = 0; i < 18; i++) {
      const x = Math.random() * w;
      const y = Math.random() < .5 ? Math.random() * base : h - Math.random() * base;
      ctx.fillRect(x, y, Math.random() * 5 + 1, 1);
    }
  }

  if (state.frame === 'warm-negative') {
    const warm = ctx.createLinearGradient(0, 0, w, h);
    warm.addColorStop(0, '#2b120a');
    warm.addColorStop(.45, '#0f0705');
    warm.addColorStop(1, '#3a1708');
    ctx.fillStyle = warm;
    ctx.fillRect(0, 0, w, base * 1.15);
    ctx.fillRect(0, h - base * 1.15, w, base * 1.15);
    ctx.fillRect(0, 0, base * .85, h);
    ctx.fillRect(w - base * .85, 0, base * .85, h);

    ctx.fillStyle = 'rgba(255,180,80,.5)';
    ctx.font = `${Math.max(12, base * .38)}px monospace`;
    ctx.fillText('KODAK  35', base * .4, h - base * .35);
  }

  if (state.frame === 'rough-scan') {
    ctx.fillStyle = '#070707';
    roughEdge('top', base);
    roughEdge('bottom', base);
    roughEdge('left', base);
    roughEdge('right', base);
  }

  if (state.frame === 'white-polaroid') {
    const side = base * 1.4;
    const bottom = base * 3.2;
    ctx.fillStyle = '#f0ede3';
    ctx.fillRect(0, 0, w, side);
    ctx.fillRect(0, h - bottom, w, bottom);
    ctx.fillRect(0, 0, side, h);
    ctx.fillRect(w - side, 0, side, h);
  }

  ctx.restore();
}

function roughEdge(side, size) {
  const w = canvas.width;
  const h = canvas.height;
  const steps = side === 'top' || side === 'bottom' ? w : h;

  ctx.beginPath();

  if (side === 'top') {
    ctx.moveTo(0, 0);
    for (let i = 0; i <= steps; i += 18) ctx.lineTo(i, size * (.75 + Math.random() * .5));
    ctx.lineTo(w, 0);
  } else if (side === 'bottom') {
    ctx.moveTo(0, h);
    for (let i = 0; i <= steps; i += 18) ctx.lineTo(i, h - size * (.75 + Math.random() * .5));
    ctx.lineTo(w, h);
  } else if (side === 'left') {
    ctx.moveTo(0, 0);
    for (let i = 0; i <= steps; i += 18) ctx.lineTo(size * (.75 + Math.random() * .5), i);
    ctx.lineTo(0, h);
  } else {
    ctx.moveTo(w, 0);
    for (let i = 0; i <= steps; i += 18) ctx.lineTo(w - size * (.75 + Math.random() * .5), i);
    ctx.lineTo(w, h);
  }

  ctx.closePath();
  ctx.fill();
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
  state.frame = 'classic-black';
  state.frameScale = 1;
  state.frameOpacity = 1;
  state.grain = 0.08;

  photoInput.value = '';
  frameScale.value = 100;
  frameOpacity.value = 100;
  grain.value = 8;
  preserveRatio.checked = true;
  canvas.width = 0;
  canvas.height = 0;
  emptyState.hidden = false;
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
