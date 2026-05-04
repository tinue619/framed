import { getProduct, saveProduct, deleteProduct, getProfiles, newId } from '../../db';
import { navigate } from '../../router';
import { GLASS_TYPES } from '../../models';
import type { Product } from '../../models';
import { createTrajectoryCanvas } from './trajectory-canvas';
import { SectionCanvas } from '../section-editor/canvas';
import { createState } from '../section-editor/state';
import type { SectionState } from '../section-editor/state';
import { esc } from '../../shared/utils';
import { showToast } from '../../shared/toast';

export function renderProductEditor(root: HTMLElement, id?: string): () => void {
  const existing = id ? getProduct(id) : null;
  let product: Product = existing ?? {
    id: newId(), name: 'Новое изделие', glassType: GLASS_TYPES[0], width: 400, height: 700,
  };

  const secState: SectionState = createState();
  secState.glassThickness = product.glassThickness ?? 8;
  secState.glassSetback   = product.glassSetback   ?? 10;
  secState.assignments    = product.profileAssignments
    ? JSON.parse(JSON.stringify(product.profileAssignments))
    : [];

  let canvas:      SectionCanvas | null = null;
  let resizeOff:   (() => void) | null = null;
  let trajDestroy: (() => void) | null = null;

  // ── render ────────────────────────────────────────────────────
  root.innerHTML = `
    <div class="pe-layout">

      <div class="pe-topbar">
        <button class="btn-icon pe-back" title="Назад">
          <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span class="pe-title">${esc(product.name)}</span>
        <div class="pe-topbar-spacer"></div>
        ${existing ? `
          <button class="btn pe-delete" id="pe-delete">
            <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            Удалить
          </button>` : ''}
        <button class="btn btn-primary" id="pe-save">Сохранить</button>
      </div>

      <div class="pe-grid">

        <!-- ① поля изделия (top-left) -->
        <div class="pe-panel">
          <div class="pe-panel-header">Изделие</div>
          <div class="pe-panel-body">
            <div class="pe-field">
              <label class="pe-label" for="pe-name">Название</label>
              <input class="pe-input" id="pe-name" type="text"
                value="${esc(product.name)}" placeholder="Введите название"
                maxlength="80" autocomplete="off">
            </div>
            <div class="pe-field">
              <label class="pe-label" for="pe-glass">Вид стекла</label>
              <div class="pe-select-wrap">
                <select class="pe-select" id="pe-glass">
                  ${GLASS_TYPES.map(t =>
                    `<option value="${esc(t)}" ${product.glassType === t ? 'selected' : ''}>${esc(t)}</option>`
                  ).join('')}
                </select>
                <svg class="pe-select-arrow" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
              </div>
            </div>
            <div class="pe-row">
              <div class="pe-field">
                <label class="pe-label" for="pe-width">Ширина</label>
                <div class="pe-num-wrap">
                  <input class="pe-input pe-num" id="pe-width" type="number"
                    value="${product.width}" min="10" max="9999" step="1">
                  <span class="pe-unit">мм</span>
                </div>
              </div>
              <div class="pe-field">
                <label class="pe-label" for="pe-height">Высота</label>
                <div class="pe-num-wrap">
                  <input class="pe-input pe-num" id="pe-height" type="number"
                    value="${product.height}" min="10" max="9999" step="1">
                  <span class="pe-unit">мм</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ② пусто (top-right) -->
        <div class="pe-panel pe-panel--empty"></div>

        <!-- ③ компоновка профилей (bottom-left) -->
        <div class="pe-panel pe-panel--canvas">
          <div class="pe-panel-header">
            Компоновка профилей
            <div class="pe-panel-hc">
              <label class="pe-label">Стекло</label>
              <input class="pe-input pe-num pe-num--sm" id="pe-gt" type="number"
                value="${secState.glassThickness}" min="3" max="25" step="0.5">
              <span class="pe-unit">мм</span>
              <div class="pe-hc-sep"></div>
              <label class="pe-label">Заводка</label>
              <input class="pe-input pe-num pe-num--sm" id="pe-sb" type="number"
                value="${secState.glassSetback}" min="0" max="200" step="0.5">
              <span class="pe-unit">мм</span>
              <div class="pe-hc-sep"></div>
              <div class="pe-add-wrap">
                <button class="pe-add-btn" id="pe-add-profile" title="Добавить профиль">
                  <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Профиль
                </button>
                <div class="pe-add-dropdown" id="pe-add-dropdown"></div>
              </div>
            </div>
          </div>
          <div class="pe-canvas-wrap" id="pe-canvas-wrap">
            <canvas id="pe-canvas"></canvas>
          </div>
        </div>

        <!-- ④ свойства профиля (bottom-right) -->
        <div class="pe-panel pe-panel--props">
          <div class="pe-panel-header" id="pe-props-title">Свойства профиля</div>
          <div class="pe-props-traj" id="pe-traj-container"></div>
        </div>

      </div>
    </div>`;

  // ── canvas ────────────────────────────────────────────────────
  const canvasEl   = root.querySelector<HTMLCanvasElement>('#pe-canvas')!;
  const canvasWrap = root.querySelector<HTMLElement>('#pe-canvas-wrap')!;

  canvas = new SectionCanvas(canvasEl, secState, () => {
    const gt = root.querySelector<HTMLInputElement>('#pe-gt');
    const sb = root.querySelector<HTMLInputElement>('#pe-sb');
    if (gt) gt.value = String(Math.round(secState.glassThickness * 10) / 10);
    if (sb) sb.value = String(Math.round(secState.glassSetback   * 10) / 10);
    renderProps();
  });

  const resize = () => {
    if (!canvasWrap.isConnected) return;
    canvas?.resize(canvasWrap.clientWidth, canvasWrap.clientHeight);
  };
  window.addEventListener('resize', resize);
  resizeOff = () => window.removeEventListener('resize', resize);
  setTimeout(resize, 0);

  canvas.setProfiles(getProfiles());
  renderProps();

  // ── profile dropdown ──────────────────────────────────────────
  const addBtn      = root.querySelector<HTMLButtonElement>('#pe-add-profile')!;
  const dropdown    = root.querySelector<HTMLElement>('#pe-add-dropdown')!;

  function buildDropdown() {
    const profiles = getProfiles();
    if (!profiles.length) {
      dropdown.innerHTML = `<div class="pe-dd-empty">Нет профилей</div>`;
    } else {
      dropdown.innerHTML = profiles.map(p =>
        `<button class="pe-dd-item" data-pid="${esc(p.id)}">${esc(p.name)}</button>`
      ).join('');
      dropdown.querySelectorAll<HTMLElement>('[data-pid]').forEach(btn => {
        btn.addEventListener('click', () => {
          secState.assignments.push({ id: newId(), profileId: btn.dataset.pid!, offsetX: 0, offsetY: 0 });
          canvas?.draw();
          closeDropdown();
        });
      });
    }
  }

  function openDropdown()  { buildDropdown(); dropdown.classList.add('open'); }
  function closeDropdown() { dropdown.classList.remove('open'); }

  addBtn.addEventListener('click', e => {
    e.stopPropagation();
    dropdown.classList.contains('open') ? closeDropdown() : openDropdown();
  });
  document.addEventListener('click', closeDropdown);

  // ── events ────────────────────────────────────────────────────
  const q = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!;

  q('.pe-back').addEventListener('click', () => navigate('products'));

  q<HTMLInputElement>('#pe-name').addEventListener('input', e => {
    product.name = (e.target as HTMLInputElement).value;
  });
  q<HTMLSelectElement>('#pe-glass').addEventListener('change', e => {
    product.glassType = (e.target as HTMLSelectElement).value as Product['glassType'];
  });
  q<HTMLInputElement>('#pe-width').addEventListener('input', e => {
    const v = parseInt((e.target as HTMLInputElement).value, 10);
    if (!isNaN(v) && v > 0) product.width = v;
  });
  q<HTMLInputElement>('#pe-height').addEventListener('input', e => {
    const v = parseInt((e.target as HTMLInputElement).value, 10);
    if (!isNaN(v) && v > 0) product.height = v;
  });
  q<HTMLInputElement>('#pe-gt').addEventListener('input', e => {
    const v = parseFloat((e.target as HTMLInputElement).value);
    if (!isNaN(v) && v > 0) { secState.glassThickness = v; canvas?.draw(); }
  });
  q<HTMLInputElement>('#pe-sb').addEventListener('input', e => {
    const v = parseFloat((e.target as HTMLInputElement).value);
    if (!isNaN(v) && v >= 0) { secState.glassSetback = v; canvas?.draw(); }
  });

  q('#pe-save').addEventListener('click', () => {
    const name = q<HTMLInputElement>('#pe-name').value.trim();
    if (!name) { showToast('Введите название', 'error'); q<HTMLInputElement>('#pe-name').focus(); return; }
    product.name               = name;
    product.glassThickness     = Math.round(secState.glassThickness * 10) / 10;
    product.glassSetback       = Math.round(secState.glassSetback   * 10) / 10;
    product.profileAssignments = JSON.parse(JSON.stringify(secState.assignments));
    saveProduct(product);
    showToast('Сохранено', 'success');
    q('.pe-title').textContent = product.name;
  });

  root.querySelector<HTMLButtonElement>('#pe-delete')?.addEventListener('click', () => {
    if (!confirm(`Удалить «${product.name}»?`)) return;
    deleteProduct(product.id);
    showToast('Удалено', 'success');
    navigate('products');
  });

  // ── profile properties panel ──────────────────────────────────

  function renderProps() {
    const titleEl = root.querySelector<HTMLElement>('#pe-props-title');
    const trajContainer = root.querySelector<HTMLElement>('#pe-traj-container');
    if (!trajContainer) return;

    trajDestroy?.();
    trajDestroy = null;
    trajContainer.innerHTML = '';

    const a = secState.assignments.find(x => x.id === secState.selected);

    if (!a) {
      if (titleEl) titleEl.textContent = 'Свойства профиля';
      trajContainer.innerHTML = `
        <div class="pe-props-empty">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          Выберите профиль на схеме
        </div>`;
      return;
    }

    const prof = getProfiles().find(p => p.id === a.profileId);
    if (titleEl) titleEl.textContent = prof?.name ?? 'Профиль';

    trajDestroy = createTrajectoryCanvas(
      trajContainer,
      product.width,
      product.height,
      a,
      () => canvas?.draw(),
    );
  }

  return () => {
    canvas?.destroy();
    trajDestroy?.();
    resizeOff?.();
    document.removeEventListener('click', closeDropdown);
    root.innerHTML = '';
  };
}
