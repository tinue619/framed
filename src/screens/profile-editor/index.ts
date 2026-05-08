import { getProfile, saveProfile, deleteProfile, newId } from '../../db';
import { navigate } from '../../router';
import type { Profile, ProfileColor } from '../../models';
import { ShapeCanvas } from './shape-canvas';
import { esc } from '../../shared/utils';
import { showToast } from '../../shared/toast';

export function renderProfileEditor(root: HTMLElement, id?: string): () => void {
  const existing = id ? getProfile(id) : null;
  let profile: Profile = existing
    ? JSON.parse(JSON.stringify(existing))
    : { id: newId(), name: 'Новый профиль', glassThickness: 8, shapes: [], colors: [] };

  let shapeCanvas: ShapeCanvas | null = null;
  let resizeOff:   (() => void) | null = null;

  // ── render ────────────────────────────────────────────────────
  root.innerHTML = `
    <div class="pfe-layout">

      <div class="pfe-topbar">
        <button class="btn-icon pfe-back" title="Назад">
          <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span class="pfe-title">${esc(profile.name)}</span>
        <div class="pfe-topbar-spacer"></div>
        ${existing ? `
          <button class="btn pfe-del-btn" id="pfe-delete">
            <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            Удалить
          </button>` : ''}
        <button class="btn btn-primary" id="pfe-save">Сохранить</button>
      </div>

      <div class="pfe-grid">

        <!-- Левая колонка: настройки + цвета + точки -->
        <div class="pfe-left">

          <div class="pfe-section">
            <div class="pfe-section-title">Профиль</div>
            <div class="pfe-field">
              <label class="pfe-label" for="pfe-name">Название</label>
              <input class="pfe-input" id="pfe-name" type="text"
                value="${esc(profile.name)}" maxlength="80" autocomplete="off">
            </div>
            <div class="pfe-field">
              <label class="pfe-label" for="pfe-gt">Толщина стекла</label>
              <div class="pfe-num-wrap">
                <input class="pfe-input pfe-num" id="pfe-gt" type="number"
                  value="${profile.glassThickness}" min="3" max="25" step="0.5">
                <span class="pfe-unit">мм</span>
              </div>
            </div>
          </div>

          <div class="pfe-section">
            <div class="pfe-section-title">Цвета</div>
            <div id="pfe-colors-list"></div>
            <div id="pfe-color-form" class="pfe-color-form pfe-hidden">
              <input class="pfe-input pfe-color-name-inp" id="pfe-col-name"
                type="text" placeholder="Название цвета" maxlength="40">
              <input class="pfe-color-picker" id="pfe-col-hex" type="color" value="#b0b8c8">
              <button class="btn btn-sm btn-primary" id="pfe-col-ok">Добавить</button>
              <button class="btn btn-sm" id="pfe-col-cancel">✕</button>
            </div>
            <button class="btn btn-sm pfe-add-color-btn" id="pfe-col-open">+ Цвет</button>
          </div>

          <div class="pfe-section pfe-section--pts">
            <div class="pfe-section-title">
              Точки сечения
              <button class="btn btn-sm pfe-add-pt-btn" id="pfe-pt-add">+ Точка</button>
            </div>
            <div id="pfe-pts-list"></div>
          </div>

        </div>

        <!-- Правая колонка: канвас -->
        <div class="pfe-canvas-wrap" id="pfe-canvas-wrap">
          <canvas id="pfe-canvas"></canvas>
        </div>

      </div>
    </div>`;

  // ── canvas ────────────────────────────────────────────────────
  const canvasEl   = root.querySelector<HTMLCanvasElement>('#pfe-canvas')!;
  const canvasWrap = root.querySelector<HTMLElement>('#pfe-canvas-wrap')!;

  shapeCanvas = new ShapeCanvas(canvasEl, (pts) => {
    profile.shapes = [pts];
    renderPoints();
  });
  shapeCanvas.setPoints(profile.shapes[0] ?? [], profile.glassThickness);

  const resize = () => {
    if (!canvasWrap.isConnected) return;
    shapeCanvas?.resize(canvasWrap.clientWidth, canvasWrap.clientHeight);
  };
  window.addEventListener('resize', resize);
  resizeOff = () => window.removeEventListener('resize', resize);
  setTimeout(resize, 0);

  renderColors();
  renderPoints();

  // ── events ────────────────────────────────────────────────────
  const q = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!;

  q('.pfe-back').addEventListener('click', () => navigate('profiles'));

  q<HTMLInputElement>('#pfe-name').addEventListener('input', e => {
    profile.name = (e.target as HTMLInputElement).value;
    q('.pfe-title').textContent = profile.name;
  });

  q<HTMLInputElement>('#pfe-gt').addEventListener('input', e => {
    const v = parseFloat((e.target as HTMLInputElement).value);
    if (!isNaN(v) && v > 0) {
      profile.glassThickness = v;
      shapeCanvas?.setPoints(profile.shapes[0] ?? [], v);
    }
  });

  q('#pfe-save').addEventListener('click', () => {
    const name = q<HTMLInputElement>('#pfe-name').value.trim();
    if (!name) { showToast('Введите название', 'error'); q<HTMLInputElement>('#pfe-name').focus(); return; }
    profile.name = name;
    saveProfile(profile);
    showToast('Сохранено', 'success');
    q('.pfe-title').textContent = profile.name;
  });

  root.querySelector('#pfe-delete')?.addEventListener('click', () => {
    if (!confirm(`Удалить «${profile.name}»?`)) return;
    deleteProfile(profile.id);
    showToast('Удалено', 'success');
    navigate('profiles');
  });

  // Color form
  q('#pfe-col-open').addEventListener('click', () => {
    q('#pfe-color-form').classList.remove('pfe-hidden');
    q('#pfe-col-open').classList.add('pfe-hidden');
    q<HTMLInputElement>('#pfe-col-name').focus();
  });
  q('#pfe-col-cancel').addEventListener('click', closeColorForm);
  q('#pfe-col-ok').addEventListener('click', () => {
    const name = q<HTMLInputElement>('#pfe-col-name').value.trim();
    const hex  = q<HTMLInputElement>('#pfe-col-hex').value;
    if (!name) { q<HTMLInputElement>('#pfe-col-name').focus(); return; }
    profile.colors.push({ id: newId(), name, hex });
    renderColors();
    closeColorForm();
  });

  // Add point button
  q('#pfe-pt-add').addEventListener('click', () => {
    if (!profile.shapes[0]) profile.shapes[0] = [];
    const pts  = profile.shapes[0];
    const last = pts[pts.length - 1] ?? { x: 0, y: 0 };
    pts.push({ x: Math.round((last.x + 5) * 2) / 2, y: last.y });
    shapeCanvas?.setPoints(pts, profile.glassThickness);
    renderPoints();
  });

  // ── helpers ───────────────────────────────────────────────────

  function closeColorForm() {
    q('#pfe-color-form').classList.add('pfe-hidden');
    q('#pfe-col-open').classList.remove('pfe-hidden');
    q<HTMLInputElement>('#pfe-col-name').value = '';
    q<HTMLInputElement>('#pfe-col-hex').value  = '#b0b8c8';
  }

  function renderColors() {
    const el = root.querySelector<HTMLElement>('#pfe-colors-list')!;
    if (!profile.colors.length) {
      el.innerHTML = `<p class="pfe-empty-sm">Нет цветов</p>`;
    } else {
      el.innerHTML = profile.colors.map(c => `
        <div class="pfe-color-chip">
          <span class="pfe-color-dot" style="background:${esc(c.hex)}"></span>
          <span class="pfe-color-chip-name">${esc(c.name)}</span>
          <button class="pfe-color-del" data-cid="${esc(c.id)}" title="Удалить">✕</button>
        </div>
      `).join('');
      el.querySelectorAll<HTMLElement>('.pfe-color-del').forEach(btn => {
        btn.addEventListener('click', () => {
          profile.colors = profile.colors.filter((c: ProfileColor) => c.id !== btn.dataset.cid);
          renderColors();
        });
      });
    }
  }

  function renderPoints() {
    const el = root.querySelector<HTMLElement>('#pfe-pts-list');
    if (!el) return;
    const pts = profile.shapes[0] ?? [];
    if (!pts.length) {
      el.innerHTML = `<p class="pfe-empty-sm">Двойной клик на канвасе — добавить точку</p>`;
      return;
    }
    el.innerHTML = `
      <div class="pfe-pts-table">
        ${pts.map((p, i) => `
          <div class="pfe-pt-row">
            <span class="pfe-pt-idx">${i + 1}</span>
            <label>X</label>
            <input class="pfe-input pfe-num pfe-num--xs" type="number"
              data-pi="${i}" data-axis="x" value="${p.x}" step="0.5">
            <label>Y</label>
            <input class="pfe-input pfe-num pfe-num--xs" type="number"
              data-pi="${i}" data-axis="y" value="${p.y}" step="0.5">
            ${pts.length > 3 ? `
              <button class="pfe-pt-del" data-pi="${i}" title="Удалить точку">✕</button>
            ` : '<span class="pfe-pt-del-ph"></span>'}
          </div>
        `).join('')}
      </div>`;

    el.querySelectorAll<HTMLInputElement>('input[data-pi]').forEach(inp => {
      inp.addEventListener('change', () => {
        const i    = parseInt(inp.dataset.pi!);
        const axis = inp.dataset.axis as 'x' | 'y';
        const v    = parseFloat(inp.value);
        if (!isNaN(v) && profile.shapes[0]?.[i]) {
          profile.shapes[0][i][axis] = v;
          shapeCanvas?.setPoints(profile.shapes[0], profile.glassThickness);
        }
      });
    });

    el.querySelectorAll<HTMLElement>('.pfe-pt-del').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = parseInt(btn.dataset.pi!);
        profile.shapes[0]?.splice(i, 1);
        shapeCanvas?.setPoints(profile.shapes[0] ?? [], profile.glassThickness);
        renderPoints();
      });
    });
  }

  return () => {
    shapeCanvas?.destroy();
    resizeOff?.();
    root.innerHTML = '';
  };
}
