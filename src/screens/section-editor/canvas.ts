import type { Profile } from '../../models';
import type { SectionState } from './state';

interface DragState {
  type:        'assignment' | 'edge';
  id?:         string;
  startSX:     number; startSY: number;  // стартовые экранные координаты
  origOffsetX?: number; origOffsetY?: number;
  origSetback?: number;
}
interface PanState { startSX: number; startSY: number; origPanX: number; origPanY: number; }

export class SectionCanvas {
  private readonly ctx: CanvasRenderingContext2D;
  private profiles = new Map<string, Profile>();
  private drag:  DragState | null = null;
  private pan:   PanState  | null = null;
  private _cursor = { x: 0, y: 0 };  // текущий курсор (экран, для будущих нужд)

  // хранение ссылок на слушатели для cleanup
  private readonly off: Array<() => void> = [];

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly state:  SectionState,
    private readonly onChange: () => void,   // вызывается при изменении state
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.init();
  }

  // ── public API ──────────────────────────────────────────────

  setProfiles(profiles: Profile[]) {
    this.profiles.clear();
    profiles.forEach(p => this.profiles.set(p.id, p));
    this.draw();
  }

  draw() {
    const { canvas, ctx } = this;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#f0f2f5';
    ctx.fillRect(0, 0, W, H);

    this.drawGrid(W, H);
    this.drawAxes(W, H);
    this.drawGlass(W, H);
    this.drawMdfPieces();
    this.drawAssignments();
    this.drawHint(W, H);
  }

  resize(w: number, h: number) {
    const first = this.state.panX === 0 && this.state.panY === 0;
    this.canvas.width  = w;
    this.canvas.height = h;
    if (first) {
      this.state.panX = w / 2;
      this.state.panY = h * 0.35;
    }
    this.draw();
  }

  destroy() { this.off.forEach(fn => fn()); }

  // ── координаты ──────────────────────────────────────────────

  private toScreen(mmX: number, mmY: number) {
    return { x: this.state.panX + mmX * this.state.scale,
             y: this.state.panY - mmY * this.state.scale };
  }
  private toMm(sx: number, sy: number) {
    return { x: (sx - this.state.panX) / this.state.scale,
             y: -((sy - this.state.panY) / this.state.scale) };
  }

  // ── рисование ───────────────────────────────────────────────

  private drawGrid(W: number, H: number) {
    const { panX, panY, scale } = this.state;
    const x0 = (0 - panX) / scale, x1 = (W - panX) / scale;
    const y0 = (panY - H) / scale, y1 = panY / scale;
    const ctx = this.ctx;

    const lines = (step: number, color: string, lw: number) => {
      ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.beginPath();
      for (let x = Math.floor(x0/step)*step; x <= x1; x += step)
        { const sx = panX + x*scale; ctx.moveTo(sx, 0); ctx.lineTo(sx, H); }
      for (let y = Math.floor(y0/step)*step; y <= y1; y += step)
        { const sy = panY - y*scale; ctx.moveTo(0, sy); ctx.lineTo(W, sy); }
      ctx.stroke();
    };

    if (scale >= 5) lines(1, '#e4e7ec', 0.4);
    lines(5,  '#d0d5dd', 0.5);
    lines(10, '#b0b8c8', 1);

    // подписи по 10 мм
    ctx.fillStyle = '#99a'; ctx.font = '9px sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    for (let x = Math.ceil(x0/10)*10; x <= x1; x += 10) {
      const sx = panX + x*scale;
      if (sx > 2 && sx < W - 10) ctx.fillText(String(x), sx + 2, 2);
    }
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (let y = Math.ceil(y0/10)*10; y <= y1; y += 10) {
      const sy = panY - y*scale;
      if (sy > 12 && sy < H - 2) ctx.fillText(String(y), panX - 4, sy);
    }
  }

  private drawAxes(W: number, H: number) {
    const { panX, panY } = this.state;
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1; ctx.setLineDash([]);
    ctx.beginPath();
    if (panY >= 0 && panY <= H) { ctx.moveTo(0, panY); ctx.lineTo(W, panY); }
    if (panX >= 0 && panX <= W) { ctx.moveTo(panX, 0); ctx.lineTo(panX, H); }
    ctx.stroke();
  }

  private drawGlass(W: number, H: number) {
    const { panX, panY, scale, glassThickness: GT, glassSetback: sb, hover } = this.state;
    const ctx = this.ctx;

    const yEdge = panY + sb * scale;   // торец стекла (ниже границы = вниз по экрану)
    const gL    = panX - GT / 2 * scale;
    const gR    = panX + GT / 2 * scale;
    const cL = Math.max(0, gL), cR = Math.min(W, gR);
    const top = Math.max(0, yEdge);

    // тело стекла
    if (cL < cR && top < H) {
      ctx.fillStyle = 'rgba(147,210,240,0.30)';
      ctx.fillRect(cL, top, cR - cL, H - top);
      ctx.strokeStyle = 'rgba(47,102,126,0.22)'; ctx.lineWidth = 1; ctx.setLineDash([]);
      if (gL >= 0 && gL <= W) { ctx.beginPath(); ctx.moveTo(gL, top); ctx.lineTo(gL, H); ctx.stroke(); }
      if (gR >= 0 && gR <= W) { ctx.beginPath(); ctx.moveTo(gR, top); ctx.lineTo(gR, H); ctx.stroke(); }
      // торец — верхняя грань
      if (yEdge >= 0 && yEdge <= H) {
        ctx.strokeStyle = 'rgba(47,102,126,0.70)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(cL, yEdge); ctx.lineTo(cR, yEdge); ctx.stroke();
      }
    }

    // пунктирная линия торца (draggable)
    const isHov = hover === 'edge';
    if (yEdge >= -10 && yEdge <= H + 10) {
      ctx.strokeStyle = isHov ? '#2f667e' : 'rgba(47,102,126,0.60)';
      ctx.lineWidth   = isHov ? 2.5 : 1.5;
      ctx.setLineDash([7, 5]);
      ctx.beginPath(); ctx.moveTo(0, yEdge); ctx.lineTo(W, yEdge); ctx.stroke();
      ctx.setLineDash([]);

      // ручка-стрелка
      const hx = 24;
      ctx.fillStyle = isHov ? '#2f667e' : 'rgba(47,102,126,0.60)';
      ctx.beginPath(); ctx.moveTo(hx-6, yEdge-1); ctx.lineTo(hx, yEdge-7); ctx.lineTo(hx+6, yEdge-1); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(hx-6, yEdge+1); ctx.lineTo(hx, yEdge+7); ctx.lineTo(hx+6, yEdge+1); ctx.closePath(); ctx.fill();

      ctx.fillStyle = isHov ? '#2f667e' : 'rgba(47,102,126,0.65)';
      ctx.font      = (isHov ? 'bold ' : '') + '10px sans-serif';
      ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
      ctx.fillText(`заводка ${sb} мм  ·  стекло ${GT} мм`, 40, yEdge - 3);
    }

    // граница изделия
    const yB = panY;
    if (yB >= -10 && yB <= H + 10) {
      ctx.strokeStyle = '#2f667e'; ctx.lineWidth = 2; ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(0, yB); ctx.lineTo(W, yB); ctx.stroke();
      ctx.fillStyle = '#2f667e'; ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText('граница изделия', 8, yB + 3);
    }
  }

  private drawAssignments() {
    const { assignments, selected, hover } = this.state;
    const ctx = this.ctx;

    for (const a of assignments) {
      const prof = this.profiles.get(a.profileId);
      if (!prof?.shapes?.[0]?.length) continue;
      const pts   = prof.shapes[0];
      const isSel = selected === a.id;
      const isHov = hover    === a.id;

      ctx.beginPath();
      pts.forEach((p, i) => {
        const s = this.toScreen(p.x + a.offsetX, p.y + a.offsetY);
        if (i === 0) ctx.moveTo(s.x, s.y); else ctx.lineTo(s.x, s.y);
      });
      ctx.closePath();
      ctx.fillStyle   = isSel ? 'rgba(47,102,126,0.28)' : isHov ? 'rgba(47,102,126,0.18)' : 'rgba(47,102,126,0.10)';
      ctx.fill();
      ctx.strokeStyle = isSel ? '#2f667e' : isHov ? '#4a90a4' : 'rgba(47,102,126,0.50)';
      ctx.lineWidth   = isSel ? 2 : 1.5;
      ctx.setLineDash([]);
      ctx.stroke();

      // метка при hover/select
      if (isHov || isSel) {
        const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length + a.offsetX;
        const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length + a.offsetY;
        const sc = this.toScreen(cx, cy);
        ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillText(prof.name, sc.x+1, sc.y+1);
        ctx.fillStyle = '#1d1d1f';               ctx.fillText(prof.name, sc.x,   sc.y);
      }
    }
  }

  private drawMdfPieces() {
    const { mdfPieces, selected, hover } = this.state;
    const ctx = this.ctx;

    for (const m of mdfPieces) {
      if (m.shape.length < 2) continue;
      const isSel = selected === m.id;
      const isHov = hover    === m.id;

      ctx.beginPath();
      m.shape.forEach((p, i) => {
        const s = this.toScreen(p.x + m.offsetX, p.y + m.offsetY);
        if (i === 0) ctx.moveTo(s.x, s.y); else ctx.lineTo(s.x, s.y);
      });
      ctx.closePath();
      ctx.fillStyle   = isSel ? 'rgba(120,72,30,0.28)' : isHov ? 'rgba(120,72,30,0.16)' : 'rgba(120,72,30,0.10)';
      ctx.fill();
      ctx.strokeStyle = isSel ? '#78481e' : isHov ? '#9a6030' : 'rgba(120,72,30,0.45)';
      ctx.lineWidth   = isSel ? 2 : 1.5;
      ctx.setLineDash([]);
      ctx.stroke();

      if (isHov || isSel) {
        const cx = m.shape.reduce((s, p) => s + p.x, 0) / m.shape.length + m.offsetX;
        const cy = m.shape.reduce((s, p) => s + p.y, 0) / m.shape.length + m.offsetY;
        const sc = this.toScreen(cx, cy);
        ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillText('МДФ', sc.x + 1, sc.y + 1);
        ctx.fillStyle = '#1d1d1f';               ctx.fillText('МДФ', sc.x,     sc.y);
      }
    }
  }

  private drawHint(W: number, H: number) {
    this.ctx.fillStyle = 'rgba(0,0,0,0.25)'; this.ctx.font = '10px sans-serif';
    this.ctx.textAlign = 'center'; this.ctx.textBaseline = 'bottom';
    this.ctx.fillText('↕ тянуть торец · профиль перетащить · колёсико — масштаб · ПКМ — панорама', W/2, H - 5);
  }

  // ── hit test ─────────────────────────────────────────────────

  private hitTest(sx: number, sy: number): string | 'edge' | null {
    const { state } = this;
    const yEdge = state.panY + state.glassSetback * state.scale;
    if (Math.abs(sy - yEdge) < 8) return 'edge';

    const mm = this.toMm(sx, sy);

    // МДФ (поверх профилей по z-порядку)
    for (const m of [...state.mdfPieces].reverse()) {
      if (m.shape.length < 3) continue;
      if (this.ptInPoly(mm.x - m.offsetX, mm.y - m.offsetY, m.shape)) return m.id;
    }

    // Профильные назначения
    for (const a of [...state.assignments].reverse()) {
      const prof = this.profiles.get(a.profileId);
      if (!prof?.shapes?.[0]?.length) continue;
      if (this.ptInPoly(mm.x - a.offsetX, mm.y - a.offsetY, prof.shapes[0])) return a.id;
    }

    return null;
  }

  private ptInPoly(x: number, y: number, pts: { x: number; y: number }[]) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i].x, yi = pts[i].y, xj = pts[j].x, yj = pts[j].y;
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  // ── events ───────────────────────────────────────────────────

  private init() {
    const c = this.canvas;
    const onMove  = (e: MouseEvent) => this.onMove(e);
    const onDown  = (e: MouseEvent) => this.onDown(e);
    const onUp    = ()               => this.onUp();
    const onLeave = ()               => { this.state.hover = null; this.draw(); };
    const onWheel = (e: WheelEvent)  => this.onWheel(e);
    const onCtx   = (e: Event)       => e.preventDefault();

    c.addEventListener('mousemove',   onMove);
    c.addEventListener('mousedown',   onDown);
    c.addEventListener('mouseup',     onUp);
    c.addEventListener('mouseleave',  onLeave);
    c.addEventListener('wheel',       onWheel, { passive: false });
    c.addEventListener('contextmenu', onCtx);

    this.off.push(
      () => c.removeEventListener('mousemove',   onMove),
      () => c.removeEventListener('mousedown',   onDown),
      () => c.removeEventListener('mouseup',     onUp),
      () => c.removeEventListener('mouseleave',  onLeave),
      () => c.removeEventListener('wheel',       onWheel),
      () => c.removeEventListener('contextmenu', onCtx),
    );
  }

  private onMove(e: MouseEvent) {
    const r  = this.canvas.getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;
    this._cursor.x = sx; this._cursor.y = sy;

    if (this.pan) {
      this.state.panX = this.pan.origPanX + (sx - this.pan.startSX);
      this.state.panY = this.pan.origPanY + (sy - this.pan.startSY);
      this.draw(); return;
    }

    if (this.drag) {
      const dmx = (sx - this.drag.startSX) / this.state.scale;
      const dmy = -(sy - this.drag.startSY) / this.state.scale;

      if (this.drag.type === 'edge') {
        const dy = (sy - this.drag.startSY) / this.state.scale;
        this.state.glassSetback = Math.max(0, (this.drag.origSetback ?? 0) + dy);
        this.onChange();
      } else if (this.drag.type === 'assignment' && this.drag.id) {
        const item =
          this.state.assignments.find(x => x.id === this.drag!.id) ??
          this.state.mdfPieces.find(x => x.id === this.drag!.id);
        if (item) {
          item.offsetX = (this.drag.origOffsetX ?? 0) + dmx;
          item.offsetY = (this.drag.origOffsetY ?? 0) + dmy;
          this.onChange();
        }
      }
      this.draw(); return;
    }

    const hit = this.hitTest(sx, sy);
    if (hit !== this.state.hover) { this.state.hover = hit; this.draw(); }
  }

  private onDown(e: MouseEvent) {
    e.preventDefault();
    const r  = this.canvas.getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;

    if (e.button === 1 || e.button === 2) {
      this.pan = { startSX: sx, startSY: sy, origPanX: this.state.panX, origPanY: this.state.panY };
      return;
    }

    const hit = this.hitTest(sx, sy);
    if (hit === 'edge') {
      this.drag = { type: 'edge', startSX: sx, startSY: sy, origSetback: this.state.glassSetback };
    } else if (hit) {
      const item =
        this.state.assignments.find(x => x.id === hit) ??
        this.state.mdfPieces.find(x => x.id === hit);
      this.drag = { type: 'assignment', id: hit, startSX: sx, startSY: sy,
                    origOffsetX: item?.offsetX ?? 0, origOffsetY: item?.offsetY ?? 0 };
      this.state.selected = hit;
      this.onChange();
      this.draw();
    } else {
      this.state.selected = null;
      this.onChange();
      this.draw();
    }
  }

  private onUp() { this.drag = null; this.pan = null; }

  private onWheel(e: WheelEvent) {
    e.preventDefault();
    const r  = this.canvas.getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    const { panX, panY, scale } = this.state;
    const newScale = Math.max(0.5, Math.min(40, scale * factor));
    this.state.panX  = sx - (sx - panX) * (newScale / scale);
    this.state.panY  = sy - (sy - panY) * (newScale / scale);
    this.state.scale = newScale;
    this.draw();
  }
}
