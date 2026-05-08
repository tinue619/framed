import type { Point } from '../../models';

const HANDLE_R = 6;
const HIT_R    = 10;

export class ShapeCanvas {
  private readonly ctx: CanvasRenderingContext2D;
  private pts:      Point[] = [];
  private gt        = 8;
  private panX      = 0;
  private panY      = 0;
  private scale     = 8;   // px/mm
  private selected: number | null = null;
  private hover:    number | null = null;
  private drag:     { idx: number } | null = null;
  private pan:      { sx: number; sy: number; ox: number; oy: number } | null = null;
  private readonly off: Array<() => void> = [];

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly onChange: (pts: Point[]) => void,
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.init();
  }

  // ── public API ───────────────────────────────────────────────

  setPoints(pts: Point[], gt = 8) {
    this.pts = pts.map(p => ({ ...p }));
    this.gt  = gt;
    this.draw();
  }

  getPoints(): Point[] { return this.pts.map(p => ({ ...p })); }

  resize(w: number, h: number) {
    const first = this.panX === 0 && this.panY === 0;
    this.canvas.width  = w;
    this.canvas.height = h;
    if (first) { this.panX = w / 2; this.panY = h / 2; }
    this.draw();
  }

  destroy() { this.off.forEach(fn => fn()); }

  // ── draw ─────────────────────────────────────────────────────

  draw() {
    const { canvas, ctx, pts } = this;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#f0f2f5';
    ctx.fillRect(0, 0, W, H);

    this.drawGrid(W, H);
    this.drawGlassRef();
    this.drawAxes(W, H);
    this.drawShape(pts);
    this.drawHandles(pts);
    this.drawHint(W, H);
  }

  private drawGrid(W: number, H: number) {
    const { panX, panY, scale } = this;
    const x0 = (0 - panX) / scale, x1 = (W - panX) / scale;
    const y0 = (panY - H) / scale, y1 = panY / scale;
    const ctx = this.ctx;

    const lines = (step: number, color: string, lw: number) => {
      ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.beginPath();
      for (let x = Math.floor(x0 / step) * step; x <= x1; x += step) {
        const sx = panX + x * scale; ctx.moveTo(sx, 0); ctx.lineTo(sx, H);
      }
      for (let y = Math.floor(y0 / step) * step; y <= y1; y += step) {
        const sy = panY - y * scale; ctx.moveTo(0, sy); ctx.lineTo(W, sy);
      }
      ctx.stroke();
    };

    if (scale >= 5) lines(1, '#e4e7ec', 0.4);
    lines(5,  '#d0d5dd', 0.5);
    lines(10, '#b0b8c8', 1.0);

    ctx.fillStyle = '#aab'; ctx.font = '9px sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    const x0r = Math.ceil(x0 / 10) * 10;
    for (let x = x0r; x <= x1; x += 10) {
      const sx = panX + x * scale;
      if (sx > 2 && sx < W - 10) ctx.fillText(String(x), sx + 2, 2);
    }
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    const y0r = Math.ceil(y0 / 10) * 10;
    for (let y = y0r; y <= y1; y += 10) {
      const sy = panY - y * scale;
      if (sy > 12 && sy < H - 2) ctx.fillText(String(y), panX - 4, sy);
    }
  }

  private drawGlassRef() {
    const { ctx, gt } = this;
    const gL = this.sx(-gt / 2), gR = this.sx(gt / 2);
    const top = 0, bot = this.canvas.height;
    if (gL >= gR) return;
    ctx.fillStyle = 'rgba(147,210,240,0.18)';
    ctx.fillRect(gL, top, gR - gL, bot - top);
    ctx.strokeStyle = 'rgba(47,102,126,0.28)'; ctx.lineWidth = 1; ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(gL, top); ctx.lineTo(gL, bot); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(gR, top); ctx.lineTo(gR, bot); ctx.stroke();
  }

  private drawAxes(W: number, _H: number) {
    const ctx = this.ctx;
    // Y=0 dashed line (граница изделия)
    const py = this.panY;
    ctx.strokeStyle = 'rgba(47,102,126,0.50)'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(W, py); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(47,102,126,0.60)'; ctx.font = '10px sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    ctx.fillText('граница изделия (Y=0)', 8, py - 3);
  }

  private drawShape(pts: Point[]) {
    if (pts.length < 2) return;
    const ctx = this.ctx;
    ctx.beginPath();
    pts.forEach((p, i) => {
      const sx = this.sx(p.x), sy = this.sy(p.y);
      if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
    });
    ctx.closePath();
    ctx.fillStyle   = 'rgba(47,102,126,0.15)';
    ctx.strokeStyle = '#2f667e';
    ctx.lineWidth   = 2;
    ctx.setLineDash([]);
    ctx.fill();
    ctx.stroke();
  }

  private drawHandles(pts: Point[]) {
    const ctx = this.ctx;
    pts.forEach((p, i) => {
      const sx = this.sx(p.x), sy = this.sy(p.y);
      const isSel = this.selected === i;
      const isHov = this.hover    === i;
      ctx.beginPath();
      ctx.arc(sx, sy, isSel ? HANDLE_R + 1 : HANDLE_R, 0, Math.PI * 2);
      ctx.fillStyle   = isSel ? '#2f667e' : (isHov ? '#4a90a4' : '#fff');
      ctx.strokeStyle = '#2f667e';
      ctx.lineWidth   = 2;
      ctx.fill(); ctx.stroke();

      ctx.fillStyle        = isSel ? '#fff' : '#2f667e';
      ctx.font             = 'bold 9px sans-serif';
      ctx.textAlign        = 'center';
      ctx.textBaseline     = 'middle';
      ctx.fillText(String(i + 1), sx, sy);
    });
  }

  private drawHint(W: number, H: number) {
    this.ctx.fillStyle = 'rgba(0,0,0,0.22)';
    this.ctx.font = '10px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'bottom';
    this.ctx.fillText(
      'Двойной клик — добавить точку  ·  Del/Backspace — удалить  ·  ПКМ/СКМ — панорама  ·  Колёсико — масштаб',
      W / 2, H - 4,
    );
  }

  // ── coordinate helpers ────────────────────────────────────────

  private sx(mmX: number) { return this.panX + mmX * this.scale; }
  private sy(mmY: number) { return this.panY - mmY * this.scale; }
  private mmX(sx: number) { return (sx - this.panX) / this.scale; }
  private mmY(sy: number) { return -(sy - this.panY) / this.scale; }

  private clientPos(e: MouseEvent) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  // ── hit test ─────────────────────────────────────────────────

  private hitPoint(sx: number, sy: number): number {
    for (let i = this.pts.length - 1; i >= 0; i--) {
      const px = this.sx(this.pts[i].x), py = this.sy(this.pts[i].y);
      if (Math.hypot(sx - px, sy - py) < HIT_R) return i;
    }
    return -1;
  }

  private distToSegment(p: Point, a: Point, b: Point): number {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
  }

  // ── events ───────────────────────────────────────────────────

  private init() {
    const c = this.canvas;
    const onMove  = (e: MouseEvent) => this.onMove(e);
    const onDown  = (e: MouseEvent) => this.onDown(e);
    const onUp    = ()               => this.onUp();
    const onDbl   = (e: MouseEvent) => this.onDbl(e);
    const onKey   = (e: KeyboardEvent) => this.onKey(e);
    const onWheel = (e: WheelEvent) => this.onWheel(e);
    const onCtx   = (e: Event) => e.preventDefault();

    c.setAttribute('tabindex', '0');
    c.addEventListener('mousemove',   onMove);
    c.addEventListener('mousedown',   onDown);
    c.addEventListener('mouseup',     onUp);
    c.addEventListener('dblclick',    onDbl);
    c.addEventListener('wheel',       onWheel, { passive: false });
    c.addEventListener('contextmenu', onCtx);
    c.addEventListener('keydown',     onKey);

    this.off.push(
      () => c.removeEventListener('mousemove',   onMove),
      () => c.removeEventListener('mousedown',   onDown),
      () => c.removeEventListener('mouseup',     onUp),
      () => c.removeEventListener('dblclick',    onDbl),
      () => c.removeEventListener('wheel',       onWheel),
      () => c.removeEventListener('contextmenu', onCtx),
      () => c.removeEventListener('keydown',     onKey),
    );
  }

  private onMove(e: MouseEvent) {
    const { x, y } = this.clientPos(e);

    if (this.pan) {
      this.panX = this.pan.ox + (x - this.pan.sx);
      this.panY = this.pan.oy + (y - this.pan.sy);
      this.draw(); return;
    }

    if (this.drag !== null) {
      const snap = (v: number) => Math.round(v * 2) / 2;  // 0.5 mm шаг
      this.pts[this.drag.idx] = { x: snap(this.mmX(x)), y: snap(this.mmY(y)) };
      this.onChange(this.getPoints());
      this.draw(); return;
    }

    const hit = this.hitPoint(x, y);
    const newHov = hit >= 0 ? hit : null;
    if (newHov !== this.hover) { this.hover = newHov; this.draw(); }
    this.canvas.style.cursor = hit >= 0 ? 'grab' : 'crosshair';
  }

  private onDown(e: MouseEvent) {
    e.preventDefault();
    this.canvas.focus();
    const { x, y } = this.clientPos(e);

    if (e.button === 1 || e.button === 2) {
      this.pan = { sx: x, sy: y, ox: this.panX, oy: this.panY };
      return;
    }

    const hit = this.hitPoint(x, y);
    if (hit >= 0) {
      this.selected = hit;
      this.drag = { idx: hit };
      this.canvas.style.cursor = 'grabbing';
      this.draw();
    } else {
      this.selected = null;
      this.draw();
    }
  }

  private onUp() {
    this.drag = null;
    this.pan  = null;
    this.canvas.style.cursor = this.hover !== null ? 'grab' : 'crosshair';
  }

  private onDbl(e: MouseEvent) {
    const { x, y } = this.clientPos(e);
    if (this.hitPoint(x, y) >= 0) return;

    const snap = (v: number) => Math.round(v * 2) / 2;
    const newPt: Point = { x: snap(this.mmX(x)), y: snap(this.mmY(y)) };

    if (this.pts.length < 2) {
      this.pts.push(newPt);
      this.selected = this.pts.length - 1;
    } else {
      // Insert at nearest edge
      const mm = { x: this.mmX(x), y: this.mmY(y) };
      let bestDist = Infinity, bestIdx = this.pts.length;
      for (let i = 0; i < this.pts.length; i++) {
        const d = this.distToSegment(mm, this.pts[i], this.pts[(i + 1) % this.pts.length]);
        if (d < bestDist) { bestDist = d; bestIdx = i + 1; }
      }
      this.pts.splice(bestIdx, 0, newPt);
      this.selected = bestIdx;
    }

    this.onChange(this.getPoints());
    this.draw();
  }

  private onKey(e: KeyboardEvent) {
    if ((e.key === 'Delete' || e.key === 'Backspace') && this.selected !== null) {
      if (this.pts.length > 3) {
        this.pts.splice(this.selected, 1);
        this.selected = null;
        this.onChange(this.getPoints());
        this.draw();
      }
    }
  }

  private onWheel(e: WheelEvent) {
    e.preventDefault();
    const { x, y } = this.clientPos(e);
    const factor   = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    const newScale = Math.max(0.5, Math.min(60, this.scale * factor));
    this.panX  = x - (x - this.panX) * (newScale / this.scale);
    this.panY  = y - (y - this.panY) * (newScale / this.scale);
    this.scale = newScale;
    this.draw();
  }
}
