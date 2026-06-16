// Módulo DICOM: parse, viewer com WW/WL ajustável, presets, scrubber, multi-slice
const Dicom = (() => {
  const CDN_DICOM_PARSER = 'https://unpkg.com/dicom-parser@1.8.21/dist/dicomParser.min.js';
  const CDN_JSZIP = 'https://unpkg.com/jszip@3.10.1/dist/jszip.min.js';

  // Presets WL/WW (em Hounsfield Units para CT, mas funcionam como aproximação para outras modalidades)
  const PRESETS = [
    { name: 'Auto (do DICOM)', wl: null, ww: null },
    { name: 'Osso', wl: 400, ww: 1800 },
    { name: 'Pulmão', wl: -600, ww: 1500 },
    { name: 'Mediastino', wl: 50, ww: 350 },
    { name: 'Cérebro', wl: 40, ww: 80 },
    { name: 'Abdome', wl: 50, ww: 400 },
    { name: 'Fígado', wl: 60, ww: 150 },
    { name: 'AVC isquêmico', wl: 35, ww: 30 },
    { name: 'Coluna', wl: 50, ww: 250 },
    { name: 'Angio CT', wl: 200, ww: 700 },
  ];

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Falha ao carregar: ' + src));
      document.head.appendChild(s);
    });
  }

  async function ensureLibs() {
    if (!window.dicomParser) await loadScript(CDN_DICOM_PARSER);
    if (!window.JSZip) await loadScript(CDN_JSZIP);
  }

  function isDicomName(name) {
    const n = name.toLowerCase();
    if (n.endsWith('.dcm') || n.endsWith('.dicom') || n.endsWith('.ima')) return true;
    // PACS exports often have no extension
    if (!/\.[a-z0-9]+$/i.test(n)) return true;
    return false;
  }

  // ===== Public: detect if user dropped DICOMs =====
  function looksLikeDicom(file) {
    const n = (file.name || '').toLowerCase();
    if (n.endsWith('.dcm') || n.endsWith('.dicom') || n.endsWith('.ima')) return true;
    return false;
  }

  // Extrai todos os arquivos de um ZIP sem filtrar — chamado por app.js antes de rotear.
  async function extractZipAll(zipFile) {
    await ensureLibs();
    const zip = await window.JSZip.loadAsync(zipFile);
    const entries = Object.values(zip.files);
    const files = [];
    for (const entry of entries) {
      if (entry.dir) continue;
      if (entry.name.includes('__MACOSX') || entry.name.includes('.DS_Store')) continue;
      const blob = await entry.async('blob');
      const baseName = (entry.name.split('/').pop() || entry.name).trim();
      if (!baseName) continue;
      files.push(new File([blob], baseName, { type: blob.type || guessMime(baseName) }));
    }
    return files;
  }

  function guessMime(name) {
    const n = name.toLowerCase();
    if (/\.(jpe?g)$/.test(n)) return 'image/jpeg';
    if (/\.png$/.test(n)) return 'image/png';
    if (/\.webp$/.test(n)) return 'image/webp';
    if (/\.gif$/.test(n)) return 'image/gif';
    if (/\.mp4$/.test(n)) return 'video/mp4';
    if (/\.(mov|qt)$/.test(n)) return 'video/quicktime';
    if (/\.webm$/.test(n)) return 'video/webm';
    if (/\.(dcm|dicom|ima)$/.test(n)) return 'application/dicom';
    if (/\.txt$/.test(n)) return 'text/plain';
    return '';
  }

  // ===== Expand zips, parse all DICOMs =====
  async function expandFiles(files) {
    const expanded = [];
    for (const f of files) {
      if ((f.name || '').toLowerCase().endsWith('.zip')) {
        try {
          const zip = await window.JSZip.loadAsync(f);
          const entries = Object.values(zip.files);
          for (const entry of entries) {
            if (entry.dir) continue;
            if (!isDicomName(entry.name)) continue;
            // Skip macOS metadata
            if (entry.name.includes('__MACOSX') || entry.name.includes('.DS_Store')) continue;
            const blob = await entry.async('blob');
            const baseName = entry.name.split('/').pop() || entry.name;
            expanded.push(new File([blob], baseName));
          }
        } catch (e) {
          console.warn('Falha ao abrir zip', f.name, e);
        }
      } else {
        expanded.push(f);
      }
    }
    return expanded;
  }

  function parseFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const byteArray = new Uint8Array(reader.result);
          const dataSet = window.dicomParser.parseDicom(byteArray);
          resolve({ dataSet, byteArray, file });
        } catch (e) { reject(e); }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  function safeFloat(s, fallback = 0) {
    if (s == null || s === '') return fallback;
    const n = parseFloat((s + '').split('\\')[0]);
    return Number.isFinite(n) ? n : fallback;
  }
  function safeInt(s, fallback = 0) {
    if (s == null || s === '') return fallback;
    const n = parseInt((s + '').split('\\')[0]);
    return Number.isFinite(n) ? n : fallback;
  }

  function extractMetadata(dataSet) {
    return {
      modality: (dataSet.string('x00080060') || '').trim(),
      bodyPart: (dataSet.string('x00180015') || '').trim(),
      rows: dataSet.uint16('x00280010') || 0,
      columns: dataSet.uint16('x00280011') || 0,
      bitsAllocated: dataSet.uint16('x00280100') || 16,
      bitsStored: dataSet.uint16('x00280101') || 16,
      pixelRepresentation: dataSet.uint16('x00280103') || 0,
      numberOfFrames: safeInt(dataSet.string('x00280008'), 1) || 1,
      samplesPerPixel: dataSet.uint16('x00280002') || 1,
      rescaleIntercept: safeFloat(dataSet.string('x00281052'), 0),
      rescaleSlope: safeFloat(dataSet.string('x00281053'), 1),
      windowCenter: safeFloat(dataSet.string('x00281050'), NaN),
      windowWidth: safeFloat(dataSet.string('x00281051'), NaN),
      photometric: ((dataSet.string('x00280004') || 'MONOCHROME2').replace(/\s/g, '')),
      instanceNumber: safeInt(dataSet.string('x00200013'), 0),
      sliceLocation: safeFloat(dataSet.string('x00201041'), NaN),
      seriesUID: dataSet.string('x0020000e') || '',
      seriesDescription: (dataSet.string('x0008103e') || '').trim(),
      patientSex: dataSet.string('x00100040') || '',
      patientAge: dataSet.string('x00101010') || '',
      studyDescription: (dataSet.string('x00081030') || '').trim(),
      transferSyntax: (dataSet.string('x00020010') || '').trim(),
    };
  }

  function isSupportedTransferSyntax(ts) {
    if (!ts) return true;
    return [
      '1.2.840.10008.1.2',      // Implicit VR Little Endian
      '1.2.840.10008.1.2.1',    // Explicit VR Little Endian
      '1.2.840.10008.1.2.2',    // Explicit VR Big Endian
    ].includes(ts);
  }

  function getFramePixelArray(dataSet, byteArray, meta, frameIndex) {
    const el = dataSet.elements.x7fe00010;
    if (!el) throw new Error('PixelData ausente.');
    const samples = meta.samplesPerPixel || 1;
    const bytesPerPixel = (meta.bitsAllocated / 8) * samples;
    const pixelsPerFrame = meta.rows * meta.columns * samples;
    const frameSize = pixelsPerFrame * (meta.bitsAllocated / 8);
    const offset = el.dataOffset + frameIndex * frameSize;

    if (meta.bitsAllocated === 16) {
      if (meta.pixelRepresentation === 1) return new Int16Array(byteArray.buffer, offset, pixelsPerFrame);
      return new Uint16Array(byteArray.buffer, offset, pixelsPerFrame);
    }
    if (meta.bitsAllocated === 8) return new Uint8Array(byteArray.buffer, offset, pixelsPerFrame);
    throw new Error('BitsAllocated não suportado: ' + meta.bitsAllocated);
  }

  function renderToCanvas(canvas, slice, wl, ww) {
    const { dataSet, byteArray, meta, frame } = slice;
    if (!isSupportedTransferSyntax(meta.transferSyntax)) {
      throw new Error('DICOM comprimido (Transfer Syntax ' + meta.transferSyntax + ') não suportado. Exporte como DICOM "Implicit VR Little Endian" sem compressão, ou use a opção de cine MP4 do PACS.');
    }
    const isRGB = meta.photometric === 'RGB' || meta.photometric === 'YBR_FULL' || meta.photometric === 'YBR_FULL_422';
    const isMono = meta.photometric === 'MONOCHROME1' || meta.photometric === 'MONOCHROME2';
    if (!isRGB && !isMono) throw new Error('Photometric não suportada: ' + meta.photometric);

    const pixels = getFramePixelArray(dataSet, byteArray, meta, frame);
    canvas.width = meta.columns;
    canvas.height = meta.rows;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(meta.columns, meta.rows);
    const data = img.data;

    if (isRGB) {
      // Interleaved RGB
      for (let i = 0, p = 0; i < pixels.length; i += 3, p += 4) {
        data[p] = pixels[i];
        data[p + 1] = pixels[i + 1];
        data[p + 2] = pixels[i + 2];
        data[p + 3] = 255;
      }
    } else {
      const invert = meta.photometric === 'MONOCHROME1';
      const slope = meta.rescaleSlope || 1;
      const intercept = meta.rescaleIntercept || 0;
      const wcMinus = wl - 0.5;
      const wwMinus = (ww - 1) || 1;
      for (let i = 0, p = 0; i < pixels.length; i++, p += 4) {
        let v = pixels[i] * slope + intercept;
        v = ((v - wcMinus) / wwMinus + 0.5) * 255;
        if (v < 0) v = 0; else if (v > 255) v = 255;
        if (invert) v = 255 - v;
        data[p] = data[p + 1] = data[p + 2] = v;
        data[p + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  function getDefaultWindow(meta) {
    if (Number.isFinite(meta.windowCenter) && Number.isFinite(meta.windowWidth) && meta.windowWidth > 0) {
      return { wl: meta.windowCenter, ww: meta.windowWidth };
    }
    // Sensible default by modality
    const m = (meta.modality || '').toUpperCase();
    if (m === 'CT') return { wl: 50, ww: 400 };
    if (m === 'MR') return { wl: 600, ww: 1200 };
    if (m === 'CR' || m === 'DX' || m === 'DR') return { wl: 2048, ww: 4096 };
    return { wl: 128, ww: 256 };
  }

  // ===== Public: open viewer over a set of files =====
  async function openViewer(rawFiles) {
    await ensureLibs();
    const files = await expandFiles(rawFiles);
    if (!files.length) throw new Error('Nenhum DICOM encontrado nos arquivos.');

    const slices = [];
    for (const f of files) {
      try {
        const { dataSet, byteArray } = await parseFile(f);
        const meta = extractMetadata(dataSet);
        for (let frame = 0; frame < meta.numberOfFrames; frame++) {
          slices.push({ dataSet, byteArray, frame, meta, fileName: f.name });
        }
      } catch (e) {
        console.warn('Falha parseando', f.name, e);
      }
    }
    if (!slices.length) throw new Error('Nenhum DICOM válido encontrado. Verifique se não está comprimido (JPEG2000/RLE).');

    // Sort by instanceNumber (or sliceLocation as fallback)
    slices.sort((a, b) => {
      const ai = a.meta.instanceNumber || 0, bi = b.meta.instanceNumber || 0;
      if (ai !== bi) return ai - bi;
      const al = Number.isFinite(a.meta.sliceLocation) ? a.meta.sliceLocation : 0;
      const bl = Number.isFinite(b.meta.sliceLocation) ? b.meta.sliceLocation : 0;
      return al - bl;
    });

    return new Promise((resolve, reject) => {
      const ui = buildViewerUI(slices, (selected) => {
        ui.remove();
        resolve(selected);
      }, () => {
        ui.remove();
        reject(new Error('Cancelado pelo usuário.'));
      });
      document.body.appendChild(ui);
    });
  }

  function buildViewerUI(slices, onConfirm, onCancel) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-bg';
    const firstMeta = slices[0].meta;
    const initialWindow = getDefaultWindow(firstMeta);
    const dimensions = `${firstMeta.columns}×${firstMeta.rows}`;
    const headerSub = [
      slices.length + ' corte(s)',
      firstMeta.modality || null,
      firstMeta.seriesDescription || firstMeta.studyDescription || null,
      dimensions,
    ].filter(Boolean).join(' • ');

    overlay.innerHTML = `
      <div class="modal wide">
        <div class="modal-header">
          <div>
            <div class="modal-title">Visualizador DICOM</div>
            <div class="modal-sub">${escapeHtml(headerSub)}</div>
          </div>
          <button class="modal-close" id="dv-close" title="Cancelar">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="dicom-viewer">
          <div class="dv-canvas-wrap">
            <canvas class="dv-canvas" id="dv-canvas"></canvas>
            <div class="dv-overlay" id="dv-overlay-l"></div>
            <div class="dv-overlay-right" id="dv-overlay-r"></div>
          </div>
          <div class="dv-controls">
            <div>
              <div class="dv-section-title">Presets de janela</div>
              <div class="dv-presets" id="dv-presets"></div>
            </div>
            <div class="dv-slider">
              <div class="dv-slider-row"><span>Window Width (WW)</span><strong id="dv-ww-val">${Math.round(initialWindow.ww)}</strong></div>
              <input type="range" id="dv-ww" min="1" max="4000" step="1" value="${Math.round(initialWindow.ww)}">
            </div>
            <div class="dv-slider">
              <div class="dv-slider-row"><span>Window Level (WL)</span><strong id="dv-wl-val">${Math.round(initialWindow.wl)}</strong></div>
              <input type="range" id="dv-wl" min="-1000" max="3000" step="1" value="${Math.round(initialWindow.wl)}">
            </div>
            <div>
              <div class="dv-section-title">Corte atual</div>
              <div class="dv-slice-info"><span>Corte <strong id="dv-slice-info">1 / ${slices.length}</strong></span></div>
              <input type="range" id="dv-slice" min="1" max="${slices.length}" step="1" value="1" style="width:100%; margin-top:6px;">
            </div>
            <div>
              <div class="dv-section-title">Cortes a enviar</div>
              <div class="dv-range">
                <span>De</span>
                <input type="number" id="dv-from" min="1" max="${slices.length}" value="1">
                <span>até</span>
                <input type="number" id="dv-to" min="1" max="${slices.length}" value="${Math.min(slices.length, 20)}">
                <span style="margin-left:auto;">/ ${slices.length}</span>
              </div>
              <div style="font-size:11px; color:var(--text-faint); margin-top:6px; line-height:1.5;">
                Cada corte vira uma imagem para o Gemini. Recomendado: 8–30 cortes.
              </div>
            </div>
          </div>
        </div>
        <div class="dv-footer">
          <button class="btn btn-ghost" id="dv-cancel">Cancelar</button>
          <button class="btn btn-primary" id="dv-confirm">Adicionar cortes selecionados</button>
        </div>
      </div>
    `;

    const $ = (sel) => overlay.querySelector(sel);
    const canvas = $('#dv-canvas');
    const overlayL = $('#dv-overlay-l');
    const overlayR = $('#dv-overlay-r');
    const wwSlider = $('#dv-ww');
    const wlSlider = $('#dv-wl');
    const wwVal = $('#dv-ww-val');
    const wlVal = $('#dv-wl-val');
    const sliceSlider = $('#dv-slice');
    const sliceInfo = $('#dv-slice-info');
    const fromInput = $('#dv-from');
    const toInput = $('#dv-to');
    const presetsWrap = $('#dv-presets');

    let currentSlice = 0;
    let currentWW = Math.round(initialWindow.ww);
    let currentWL = Math.round(initialWindow.wl);
    let activePreset = 'Auto (do DICOM)';

    // Presets
    PRESETS.forEach(p => {
      const btn = document.createElement('button');
      btn.className = 'dv-preset' + (p.name === activePreset ? ' active' : '');
      btn.textContent = p.name;
      btn.addEventListener('click', () => {
        activePreset = p.name;
        presetsWrap.querySelectorAll('.dv-preset').forEach(b => b.classList.toggle('active', b === btn));
        if (p.wl != null && p.ww != null) {
          currentWL = p.wl;
          currentWW = p.ww;
        } else {
          const def = getDefaultWindow(slices[currentSlice].meta);
          currentWL = Math.round(def.wl);
          currentWW = Math.round(def.ww);
        }
        wwSlider.value = currentWW; wlSlider.value = currentWL;
        wwVal.textContent = currentWW; wlVal.textContent = currentWL;
        renderCurrent();
      });
      presetsWrap.appendChild(btn);
    });

    function renderCurrent() {
      try {
        renderToCanvas(canvas, slices[currentSlice], currentWL, currentWW);
        const m = slices[currentSlice].meta;
        overlayL.innerHTML = `${escapeHtml(m.modality)}<br>${escapeHtml(m.seriesDescription || m.bodyPart || '')}`;
        overlayR.innerHTML = `Corte ${currentSlice + 1}/${slices.length}<br>WW ${currentWW} / WL ${currentWL}${m.sliceLocation ? '<br>Loc ' + m.sliceLocation.toFixed(1) : ''}`;
      } catch (e) {
        const ctx = canvas.getContext('2d');
        canvas.width = 400; canvas.height = 300;
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 400, 300);
        ctx.fillStyle = '#ef4444'; ctx.font = '12px sans-serif';
        const msg = e.message || 'Erro';
        wrapText(ctx, msg, 20, 40, 360, 16);
      }
    }

    function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
      const words = text.split(' ');
      let line = '';
      for (const w of words) {
        const test = line + w + ' ';
        if (ctx.measureText(test).width > maxWidth && line) {
          ctx.fillText(line, x, y); line = w + ' '; y += lineHeight;
        } else line = test;
      }
      ctx.fillText(line, x, y);
    }

    wwSlider.addEventListener('input', () => { currentWW = +wwSlider.value; wwVal.textContent = currentWW; activePreset = 'Custom'; presetsWrap.querySelectorAll('.dv-preset').forEach(b => b.classList.remove('active')); renderCurrent(); });
    wlSlider.addEventListener('input', () => { currentWL = +wlSlider.value; wlVal.textContent = currentWL; activePreset = 'Custom'; presetsWrap.querySelectorAll('.dv-preset').forEach(b => b.classList.remove('active')); renderCurrent(); });
    sliceSlider.addEventListener('input', () => { currentSlice = +sliceSlider.value - 1; sliceInfo.textContent = `${currentSlice + 1} / ${slices.length}`; renderCurrent(); });

    // Mouse wheel for slice navigation
    overlay.querySelector('.dv-canvas-wrap').addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 1 : -1;
      const next = Math.max(0, Math.min(slices.length - 1, currentSlice + delta));
      if (next !== currentSlice) {
        currentSlice = next;
        sliceSlider.value = currentSlice + 1;
        sliceInfo.textContent = `${currentSlice + 1} / ${slices.length}`;
        renderCurrent();
      }
    }, { passive: false });

    // Mouse drag for WW/WL (radiology classic)
    let dragging = false, lastX = 0, lastY = 0;
    canvas.addEventListener('mousedown', (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      currentWW = Math.max(1, Math.min(4000, currentWW + Math.round(dx * 5)));
      currentWL = Math.max(-1000, Math.min(3000, currentWL + Math.round(dy * 5)));
      wwSlider.value = currentWW; wwVal.textContent = currentWW;
      wlSlider.value = currentWL; wlVal.textContent = currentWL;
      activePreset = 'Custom';
      presetsWrap.querySelectorAll('.dv-preset').forEach(b => b.classList.remove('active'));
      renderCurrent();
    });
    window.addEventListener('mouseup', () => { dragging = false; });

    $('#dv-close').addEventListener('click', onCancel);
    $('#dv-cancel').addEventListener('click', onCancel);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) onCancel(); });

    $('#dv-confirm').addEventListener('click', async () => {
      let from = Math.max(1, Math.min(slices.length, +fromInput.value || 1));
      let to = Math.max(1, Math.min(slices.length, +toInput.value || slices.length));
      if (from > to) [from, to] = [to, from];
      const count = to - from + 1;
      if (count > 50 && !confirm(`Você selecionou ${count} cortes. Isso vai gerar uma chamada grande ao Gemini. Continuar?`)) return;

      $('#dv-confirm').textContent = 'Renderizando…';
      $('#dv-confirm').disabled = true;

      const rendered = [];
      const renderCanvas = document.createElement('canvas');
      for (let i = from - 1; i <= to - 1; i++) {
        try {
          renderToCanvas(renderCanvas, slices[i], currentWL, currentWW);
          const dataUrl = renderCanvas.toDataURL('image/jpeg', 0.9);
          const base64 = dataUrl.split(',')[1];
          rendered.push({
            kind: 'dicom',
            name: slices[i].fileName,
            label: `corte ${slices[i].meta.instanceNumber || (i + 1)}, ${slices[i].meta.modality || 'DICOM'}, WW ${currentWW}/WL ${currentWL}`,
            mimeType: 'image/jpeg',
            dataUrl,
            base64,
            size: dataUrl.length,
            meta: slices[i].meta,
          });
        } catch (e) {
          console.warn('Falha render corte', i, e);
        }
        // Yield to keep UI responsive
        if (i % 5 === 0) await new Promise(r => setTimeout(r, 0));
      }
      onConfirm(rendered);
    });

    // Initial render
    setTimeout(renderCurrent, 0);

    return overlay;
  }

  function escapeHtml(s) {
    return (s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  }

  return { looksLikeDicom, openViewer, extractZipAll };
})();
