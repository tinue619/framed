import { getProfiles, newId } from '../../db';
import { navigate } from '../../router';
import type { Profile } from '../../models';
import { SectionCanvas } from './canvas';
import { createPreview3D } from './preview3d';
import type { Preview3DHandle } from './preview3d';
import { createState } from './state';
import type { SectionState } from './state';
import { esc } from '../../shared/utils';
import { showToast } from '../../shared/toast';

export class SectionEditor {
  private state:    SectionState;
  private typeId:   string;
  private canvas!:  SectionCanvas;
  private preview?: Preview3DHandle;
  private resizeH?: () => void;

  constructor(private readonly root: HTMLElement) {
    this.state  = createState();
    this.typeId = this.loadType();
    this.render();
    this.initCanvas();
    this.refreshProfiles();
  }

  destroy() {
    this.canvas?.destroy();
    this.preview?.destroy();
    if (this.resizeH) window.removeEventListener('resize', this.resizeH);
  }

  // ── загрузка / сохранение ────────────────────────────────────

  private loadType(): string {
    const raw = localStorage.getItem('se_section');
    const saved = raw ? JSON.parse(raw) : null;
    this.state.glassThickness = saved?.glassThickness ?? 8;
    this.state.glassSetback   = saved?.glassSetback   ?? 10;
    this.state.assignments    = saved?.assignments ? JSON.parse(JSON.stringify(saved.assignments)) : [];
    const id = saved?.id ?? newId();
    if (!saved) localStorage.setItem('se_section', JSON.stringify({ id }));
    return id;
  }

  private saveType() {
    const data = {
      id:               this.typeId,
      glassThickness:   Math.round(this.state.glassThickness * 10) / 10,
      glassSetback:     Math.round(this.state.glassSetback   * 10) / 10,
      assignments:      JSON.parse(JSON.stringify(this.state.assignments)),
    };
    localStorage.setItem('se_section', JSON.stringify(data));
    showToast('Сохранено', 'success');
  }

  // ── рендер layout ────────────────────────────────────────────

  private render() {
    this.root.innerHTML = `
      <div class="se-layout">

        <div class="se-topbar">
          <button class="btn-icon se-back" title="Назад">
            <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
          </button>

          <div class="se-topbar-group">
            <label class="se-label">Стекло</label>
            <input class="se-num" id="se-gt" type="number" value="${this.state.glassThickness}" min="3" max="25" step="0.5">
            <span class="se-unit">мм</span>
          </div>
          <div class="se-topbar-divider"></div>
          <div class="se-topbar-group">
            <label class="se-label">Заводка</label>
            <input class="se-num" id="se-sb" type="number" value="${this.state.glassSetback}" min="0" max="200" step="0.5">
            <span class="se-unit">мм</span>
          </div>
          <div class="se-topbar-divider"></div>
          <div class="se-topbar-group">
            <button class="se-btn-3d" id="se-btn3d" title="3D предпросмотр">
              <svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
              3D
            </button>
          </div>

          <div class="se-topbar-spacer"></div>
          <button class="btn btn-primary" id="se-save">Сохранить</button>
        </div>

        <div class="se-body" id="se-body">

          <aside class="se-panel" id="se-panel">
            <div class="se-panel-section">
              <div class="se-panel-title">Профили</div>
              <div id="se-profiles-list"></div>
            </div>
            <div class="se-panel-divider"></div>
            <div class="se-panel-section">
              <div class="se-panel-title">Назначения</div>
              <div id="se-assignments-list"></div>
            </div>
          </aside>

          <div class="se-canvas-wrap" id="se-canvas-wrap">
            <canvas id="se-canvas"></canvas>
          </div>

          <div class="se-3d-panel" id="se-3d-panel">
            <div class="se-3d-bar">
              <span class="se-3d-title">3D</span>
              <input class="se-3d-dim" id="se-3d-w" type="number" value="${this.state.width3d}"  min="50" max="5000" title="Ширина мм">
              <span class="se-3d-sep">×</span>
              <input class="se-3d-dim" id="se-3d-h" type="number" value="${this.state.height3d}" min="50" max="5000" title="Высота мм">
              <span class="se-3d-sep">мм</span>
              <button class="se-3d-btn" id="se-3d-refresh" title="Обновить">
                <svg viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>
              </button>
              <button class="se-3d-btn" id="se-3d-close" title="Закрыть">
                <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div id="se-3d-container"></div>
          </div>

        </div>
      </div>
    `;

    this.bindTopbar();
  }

  private bindTopbar() {
    const q = <T extends HTMLElement>(id: string) => this.root.querySelector<T>(`#${id}`)!;

    q('se-gt').addEventListener('input', e => {
      const v = parseFloat((e.target as HTMLInputElement).value);
      if (!isNaN(v) && v > 0) { this.state.glassThickness = v; this.canvas?.draw(); }
    });

    q('se-sb').addEventListener('input', e => {
      const v = parseFloat((e.target as HTMLInputElement).value);
      if (!isNaN(v) && v >= 0) { this.state.glassSetback = v; this.canvas?.draw(); }
    });

    q<HTMLButtonElement>('se-btn3d').addEventListener('click', () => this.toggle3D());
    q<HTMLButtonElement>('se-save').addEventListener('click', () => this.saveType());
    q<HTMLButtonElement>('se-back').addEventListener('click', () => navigate('products'));

    q<HTMLButtonElement>('se-3d-refresh').addEventListener('click', () => this.refresh3D());
    q<HTMLButtonElement>('se-3d-close').addEventListener('click',   () => this.toggle3D());

    q<HTMLInputElement>('se-3d-w').addEventListener('input', e => {
      this.state.width3d = Math.max(50, +(e.target as HTMLInputElement).value);
    });
    q<HTMLInputElement>('se-3d-h').addEventListener('input', e => {
      this.state.height3d = Math.max(50, +(e.target as HTMLInputElement).value);
    });
  }

  // ── canvas ───────────────────────────────────────────────────

  private initCanvas() {
    const canvasEl = this.root.querySelector<HTMLCanvasElement>('#se-canvas')!;
    const wrap     = this.root.querySelector<HTMLElement>('#se-canvas-wrap')!;

    this.canvas = new SectionCanvas(canvasEl, this.state, () => this.onStateChange());

    const resize = () => {
      if (!wrap.isConnected) { window.removeEventListener('resize', resize); return; }
      this.canvas.resize(wrap.clientWidth, wrap.clientHeight);
    };
    this.resizeH = resize;
    window.addEventListener('resize', resize);
    setTimeout(resize, 0);
  }

  private onStateChange() {
    // синхронизируем inputs в topbar
    const gtEl = this.root.querySelector<HTMLInputElement>('#se-gt');
    const sbEl = this.root.querySelector<HTMLInputElement>('#se-sb');
    if (gtEl) gtEl.value = String(Math.round(this.state.glassThickness * 10) / 10);
    if (sbEl) sbEl.value = String(Math.round(this.state.glassSetback   * 10) / 10);
    this.renderAssignments();
  }

  // ── профили / назначения ─────────────────────────────────────

  private refreshProfiles() {
    const profiles = getProfiles();
    this.canvas?.setProfiles(profiles);
    this.renderProfilesList(profiles);
    this.renderAssignments();
  }

  private renderProfilesList(profiles: Profile[]) {
    const el = this.root.querySelector('#se-profiles-list')!;
    if (!profiles.length) {
      el.innerHTML = `<p class="se-panel-empty">Нет профилей.<br>Добавьте в разделе «Профили».</p>`;
      return;
    }
    el.innerHTML = profiles.map(p => `
      <button class="se-profile-btn" data-pid="${esc(p.id)}" title="Добавить на схему">
        <span>${esc(p.name)}</span>
        <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </button>
    `).join('');

    el.querySelectorAll<HTMLElement>('[data-pid]').forEach(btn => {
      btn.addEventListener('click', () => this.addAssignment(btn.dataset.pid!));
    });
  }

  private renderAssignments() {
    const el = this.root.querySelector('#se-assignments-list');
    if (!el) return;
    const profiles = getProfiles();

    if (!this.state.assignments.length) {
      el.innerHTML = `<p class="se-panel-empty">Нет назначений.<br>Добавьте профиль из списка выше.</p>`;
      return;
    }

    el.innerHTML = this.state.assignments.map(a => {
      const prof = profiles.find(p => p.id === a.profileId);
      return `
        <div class="se-assignment ${this.state.selected === a.id ? 'selected' : ''}" data-aid="${esc(a.id)}">
          <div class="se-assignment-name">${esc(prof?.name ?? '?')}</div>
          <div class="se-assignment-coords">
            <label>X</label><input type="number" class="se-coord-input" data-aid="${esc(a.id)}" data-axis="x" value="${a.offsetX.toFixed(1)}" step="0.5">
            <label>Y</label><input type="number" class="se-coord-input" data-aid="${esc(a.id)}" data-axis="y" value="${a.offsetY.toFixed(1)}" step="0.5">
            <button class="se-assignment-del" data-aid="${esc(a.id)}" title="Удалить">
              <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>`;
    }).join('');

    // события
    el.querySelectorAll<HTMLInputElement>('.se-coord-input').forEach(inp => {
      inp.addEventListener('change', () => {
        const { aid, axis } = inp.dataset as { aid: string; axis: string };
        const a = this.state.assignments.find(x => x.id === aid);
        if (!a) return;
        const v = parseFloat(inp.value);
        if (!isNaN(v)) { if (axis === 'x') a.offsetX = v; else a.offsetY = v; }
        this.canvas.draw();
      });
    });
    el.querySelectorAll<HTMLElement>('.se-assignment-del').forEach(btn => {
      btn.addEventListener('click', () => {
        const { aid } = btn.dataset as { aid: string };
        this.state.assignments = this.state.assignments.filter(a => a.id !== aid);
        if (this.state.selected === aid) this.state.selected = null;
        this.canvas.draw();
        this.renderAssignments();
      });
    });
    el.querySelectorAll<HTMLElement>('[data-aid]').forEach(row => {
      row.addEventListener('click', e => {
        if ((e.target as HTMLElement).closest('input, button')) return;
        this.state.selected = row.dataset.aid ?? null;
        this.canvas.draw();
        this.renderAssignments();
      });
    });
  }

  private addAssignment(profileId: string) {
    this.state.assignments.push({ id: newId(), profileId, offsetX: 0, offsetY: 0 });
    this.canvas.draw();
    this.renderAssignments();
  }

  // ── 3D ───────────────────────────────────────────────────────

  private toggle3D() {
    this.state.show3d = !this.state.show3d;
    const panel  = this.root.querySelector<HTMLElement>('#se-3d-panel')!;
    const btn    = this.root.querySelector<HTMLElement>('#se-btn3d')!;
    panel.classList.toggle('visible', this.state.show3d);
    btn.classList.toggle('active', this.state.show3d);
    if (this.state.show3d) {
      setTimeout(() => { this.refresh3D(); window.dispatchEvent(new Event('resize')); }, 30);
    } else {
      this.preview?.destroy(); this.preview = undefined;
      window.dispatchEvent(new Event('resize'));
    }
  }

  private refresh3D() {
    this.preview?.destroy();
    const container = this.root.querySelector<HTMLElement>('#se-3d-container')!;
    const profiles  = getProfiles();

    this.preview = createPreview3D({
      container,
      productW:       this.state.width3d,
      productH:       this.state.height3d,
      glassThickness: this.state.glassThickness,
      glassSetback:   this.state.glassSetback,
      assignments: this.state.assignments
        .map(a => ({
          pts: profiles.find(p => p.id === a.profileId)?.shapes?.[0] ?? [],
        }))
        .filter(a => a.pts.length >= 3),
    });
  }
}

// ── entry point ───────────────────────────────────────────────

let _editor: SectionEditor | null = null;

export function renderSectionEditor(container: HTMLElement) {
  _editor?.destroy();
  container.innerHTML = '';
  _editor = new SectionEditor(container);
}
