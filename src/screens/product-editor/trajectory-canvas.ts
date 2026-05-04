import type { ProfileAssignment, ProfileSide, CornerInsets } from '../../models';

type Corner = 'tl' | 'tr' | 'br' | 'bl';

interface HandleDef {
  corner: Corner;
  side:   ProfileSide;
  axis:   'x' | 'y';
  sign:   1 | -1;   // d(inset) = mouseDelta * sign / scale
}

const PAD        = 28;
const SIDE_COLOR = '#2f667e';
const SIDE_W     = 3;
const H_RADIUS   = 6;
const HIT_DIST   = 10;

// ── handle definitions per side ──────────────────────────────

function handleDefs(sides: ProfileSide[]): HandleDef[] {
  const d: HandleDef[] = [];
  if (sides.includes('top'))    { d.push({ corner:'tl', side:'top',    axis:'x', sign: 1  });
                                   d.push({ corner:'tr', side:'top',    axis:'x', sign:-1  }); }
  if (sides.includes('right'))  { d.push({ corner:'tr', side:'right',  axis:'y', sign: 1  });
                                   d.push({ corner:'br', side:'right',  axis:'y', sign:-1  }); }
  if (sides.includes('bottom')) { d.push({ corner:'br', side:'bottom', axis:'x', sign:-1  });
                                   d.push({ corner:'bl', side:'bottom', axis:'x', sign: 1  }); }
  if (sides.includes('left'))   { d.push({ corner:'bl', side:'left',  axis:'y', sign:-1  });
                                   d.push({ corner:'tl', side:'left',   axis:'y', sign: 1  }); }
  return d;
}

// ── pixel position of a handle ────────────────────────────────

function handlePos(
  def: HandleDef,
  rx: number, ry: number, rw: number, rh: number,
  ci: CornerInsets, scale: number,
): { x: number; y: number } {
  const { corner, side } = def;
  switch (side) {
    case 'top':
      return { x: corner === 'tl' ? rx + ci.tl * scale : rx + rw - ci.tr * scale, y: ry };
    case 'right':
      return { x: rx + rw, y: corner === 'tr' ? ry + ci.tr * scale : ry + rh - ci.br * scale };
    case 'bottom':
      return { x: corner === 'br' ? rx + rw - ci.br * scale : rx + ci.bl * scale, y: ry + rh };
    case 'left':
      return { x: rx, y: corner === 'bl' ? ry + rh - ci.bl * scale : ry + ci.tl * scale };
  }
}

// ── main factory ─────────────────────────────────────────────

export function createTrajectoryCanvas(
  container: HTMLElement,
  productW:  number,
  productH:  number,
  assignment: ProfileAssignment,
  onChange:  () => void,
): () => void {
  if (!assignment.insets) assignment.insets = { tl: 0, tr: 0, br: 0, bl: 0 };
  if (!assignment.sides)  assignment.sides  = [];

  const cv = document.createElement('canvas');
  cv.style.cssText = 'display:block;width:100%;height:100%;cursor:default;';
  container.appendChild(cv);
  const ctx = cv.getContext('2d')!;

  let rx = 0, ry = 0, rw = 0, rh = 0, scale = 1;
  let hoveredSide: ProfileSide | null = null;
  let drag: { def: HandleDef; startPx: number; startMM: number } | null = null;

  function layout() {
    const cW = cv.width, cH = cv.height;
    scale = Math.min((cW - PAD * 2) / productW, (cH - PAD * 2) / productH);
    rw = productW * scale;
    rh = productH * scale;
    rx = (cW - rw) / 2;
    ry = (cH - rh) / 2;
  }

  function draw() {
    layout();
    const { width: W, height: H } = cv;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, W, H);

    const ci     = assignment.insets!;
    const sides  = assignment.sides ?? [];
    const allSides: ProfileSide[] = ['top', 'right', 'bottom', 'left'];

    // product outline
    ctx.strokeStyle = '#dde3ec';
    ctx.lineWidth   = 1;
    ctx.strokeRect(rx, ry, rw, rh);

    // dimension labels
    ctx.fillStyle  = '#94a3b8';
    ctx.font       = '11px system-ui,sans-serif';
    ctx.textAlign  = 'center';
    ctx.fillText(`${productW} мм`, rx + rw / 2, ry - 8);
    ctx.save();
    ctx.translate(rx - 8, ry + rh / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`${productH} мм`, 0, 0);
    ctx.restore();

    // sides
    ctx.lineCap = 'round';
    for (const side of allSides) {
      const active  = sides.includes(side);
      const hovered = hoveredSide === side && !active;
      ctx.strokeStyle = active ? SIDE_COLOR : (hovered ? '#94a3b8' : '#e2e8f0');
      ctx.lineWidth   = active ? SIDE_W : (hovered ? 2 : 1);

      ctx.beginPath();
      switch (side) {
        case 'top':
          ctx.moveTo(rx + ci.tl * scale, ry);
          ctx.lineTo(rx + rw - ci.tr * scale, ry);
          break;
        case 'right':
          ctx.moveTo(rx + rw, ry + ci.tr * scale);
          ctx.lineTo(rx + rw, ry + rh - ci.br * scale);
          break;
        case 'bottom':
          ctx.moveTo(rx + rw - ci.br * scale, ry + rh);
          ctx.lineTo(rx + ci.bl * scale, ry + rh);
          break;
        case 'left':
          ctx.moveTo(rx, ry + rh - ci.bl * scale);
          ctx.lineTo(rx, ry + ci.tl * scale);
          break;
      }
      ctx.stroke();
    }

    // handles
    const defs = handleDefs(sides);
    for (const def of defs) {
      const { x, y } = handlePos(def, rx, ry, rw, rh, ci, scale);
      ctx.beginPath();
      ctx.arc(x, y, H_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle   = '#fff';
      ctx.strokeStyle = SIDE_COLOR;
      ctx.lineWidth   = 2;
      ctx.fill();
      ctx.stroke();
    }
  }

  // ── hit tests ────────────────────────────────────────────────

  function hitHandle(mx: number, my: number): HandleDef | null {
    const defs = handleDefs(assignment.sides ?? []);
    const ci   = assignment.insets!;
    for (const def of defs) {
      const { x, y } = handlePos(def, rx, ry, rw, rh, ci, scale);
      if (Math.hypot(mx - x, my - y) < H_RADIUS + 4) return def;
    }
    return null;
  }

  function hitSide(mx: number, my: number): ProfileSide | null {
    if (Math.abs(my - ry)        < HIT_DIST && mx > rx - HIT_DIST && mx < rx + rw + HIT_DIST) return 'top';
    if (Math.abs(my - (ry + rh)) < HIT_DIST && mx > rx - HIT_DIST && mx < rx + rw + HIT_DIST) return 'bottom';
    if (Math.abs(mx - rx)        < HIT_DIST && my > ry - HIT_DIST && my < ry + rh + HIT_DIST) return 'left';
    if (Math.abs(mx - (rx + rw)) < HIT_DIST && my > ry - HIT_DIST && my < ry + rh + HIT_DIST) return 'right';
    return null;
  }

  // ── event helpers ─────────────────────────────────────────────

  function pos(e: MouseEvent) {
    const r = cv.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (cv.width  / r.width),
      y: (e.clientY - r.top)  * (cv.height / r.height),
    };
  }

  // ── mouse events ─────────────────────────────────────────────

  function onDown(e: MouseEvent) {
    const { x, y } = pos(e);
    const def = hitHandle(x, y);
    if (def) {
      e.preventDefault();
      drag = { def, startPx: def.axis === 'x' ? x : y, startMM: assignment.insets![def.corner] };
      return;
    }
    const side = hitSide(x, y);
    if (side) {
      const cur = assignment.sides ?? [];
      assignment.sides = cur.includes(side) ? cur.filter(s => s !== side) : [...cur, side];
      onChange();
      draw();
    }
  }

  function onMove(e: MouseEvent) {
    const { x, y } = pos(e);
    if (drag) {
      const cur  = drag.def.axis === 'x' ? x : y;
      const dmm  = (cur - drag.startPx) * drag.def.sign / scale;
      assignment.insets![drag.def.corner] = Math.max(0, Math.round((drag.startMM + dmm) * 2) / 2);
      onChange();
      draw();
      cv.style.cursor = drag.def.axis === 'x' ? 'ew-resize' : 'ns-resize';
      return;
    }
    const def = hitHandle(x, y);
    if (def) {
      cv.style.cursor = def.axis === 'x' ? 'ew-resize' : 'ns-resize';
      return;
    }
    const side = hitSide(x, y);
    if (side !== hoveredSide) { hoveredSide = side; draw(); }
    cv.style.cursor = side ? 'pointer' : 'default';
  }

  function onUp()    { drag = null; }
  function onLeave() { drag = null; hoveredSide = null; cv.style.cursor = 'default'; draw(); }

  cv.addEventListener('mousedown',  onDown);
  cv.addEventListener('mousemove',  onMove);
  window.addEventListener('mouseup', onUp);
  cv.addEventListener('mouseleave', onLeave);

  // ── resize observer ──────────────────────────────────────────

  const ro = new ResizeObserver(() => {
    cv.width  = container.clientWidth  || 200;
    cv.height = container.clientHeight || 200;
    draw();
  });
  ro.observe(container);
  cv.width  = container.clientWidth  || 200;
  cv.height = container.clientHeight || 200;
  draw();

  return () => {
    cv.removeEventListener('mousedown',  onDown);
    cv.removeEventListener('mousemove',  onMove);
    window.removeEventListener('mouseup', onUp);
    cv.removeEventListener('mouseleave', onLeave);
    ro.disconnect();
    cv.remove();
  };
}
