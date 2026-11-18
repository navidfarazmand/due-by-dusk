// The Skills map's gestures (0.15.1; Navid, 18 Nov: "In skill I can not zoom with my fingers"). One finger (or the
// mouse) drags the map, with a little glide after a quick flick; two fingers pinch it bigger or smaller around the
// point between them, and move it at the same time; on a computer, ctrl and the wheel (a trackpad's pinch) zoom too.
// A tap still reaches the node under it; a drag does not tap. The map is a scrolling box (#dbdTreeMap) holding a
// square SVG; the screen is drawn again often (innerHTML), so the listeners sit on the screen's element, which stays.

export interface TreeZoomHost {
  /** The map's size now, in CSS pixels. */
  px(): number;
  /** Set the map's size: the host keeps it between its bounds, resizes the SVG and returns the size it took. */
  setPx(px: number): number;
}

/** How far a finger moves before a touch is a drag and not a tap. */
const SLOP = 8;

interface Pt {
  x: number;
  y: number;
}

export function attachTreeGestures(root: HTMLElement, host: TreeZoomHost): () => void {
  const pts = new Map<number, Pt>();
  let box: HTMLElement | null = null;
  let start: Pt = { x: 0, y: 0 };
  let dragging = false;
  let eatClick = false;
  // the pinch: the fingers' distance and the map's size when it began, and the map point under their middle (0..1)
  let pinch: { d0: number; px0: number; u: number; v: number } | null = null;
  // the glide after a flick
  let vx = 0,
    vy = 0,
    lastT = 0,
    glide = 0;

  const mapOf = (t: EventTarget | null): HTMLElement | null =>
    t instanceof Element ? (t.closest('#dbdTreeMap') as HTMLElement | null) : null;
  const svgOf = (b: HTMLElement): SVGSVGElement | null => b.querySelector('svg');
  const stopGlide = () => {
    if (glide) cancelAnimationFrame(glide);
    glide = 0;
  };
  const mid = (): Pt => {
    const a = [...pts.values()];
    return { x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2 };
  };
  const dist = (): number => {
    const a = [...pts.values()];
    return Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1;
  };
  /** Zoom to `px` keeping the map point (u, v) under the screen point `at`. */
  const zoomAt = (b: HTMLElement, px: number, u: number, v: number, at: Pt) => {
    host.setPx(px);
    const svg = svgOf(b);
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    b.scrollLeft += r.left + u * r.width - at.x;
    b.scrollTop += r.top + v * r.height - at.y;
  };
  const mapPoint = (b: HTMLElement, at: Pt): { u: number; v: number } => {
    const svg = svgOf(b);
    const r = svg ? svg.getBoundingClientRect() : b.getBoundingClientRect();
    return { u: (at.x - r.left) / Math.max(1, r.width), v: (at.y - r.top) / Math.max(1, r.height) };
  };
  const beginPinch = () => {
    if (!box || pts.size < 2) return;
    const m = mid();
    pinch = { d0: dist(), px0: host.px(), ...mapPoint(box, m) };
  };

  const down = (e: PointerEvent) => {
    const b = mapOf(e.target);
    if (!b || (e.pointerType === 'mouse' && e.button !== 0)) return;
    stopGlide();
    if (!pts.size) {
      box = b;
      dragging = false;
      eatClick = false;
      vx = vy = 0;
    }
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    start = { x: e.clientX, y: e.clientY };
    lastT = e.timeStamp;
    if (pts.size === 2) {
      dragging = true;
      beginPinch();
    }
  };

  const move = (e: PointerEvent) => {
    const p = pts.get(e.pointerId);
    if (!p || !box) return;
    const nx = e.clientX,
      ny = e.clientY;
    if (!dragging && Math.hypot(nx - start.x, ny - start.y) > SLOP) {
      dragging = true;
      // from here the gesture is the map's: no tap at the end (and the pointer stays with the map)
      try {
        box.setPointerCapture(e.pointerId);
      } catch {
        /* the pointer may be gone already */
      }
    }
    if (!dragging) return;
    e.preventDefault();
    if (pts.size >= 2 && pinch) {
      pts.set(e.pointerId, { x: nx, y: ny });
      zoomAt(box, pinch.px0 * (dist() / pinch.d0), pinch.u, pinch.v, mid());
      return;
    }
    const dx = nx - p.x,
      dy = ny - p.y,
      dt = Math.max(1, e.timeStamp - lastT);
    box.scrollLeft -= dx;
    box.scrollTop -= dy;
    // the flick's speed, in pixels a millisecond, smoothed
    vx = vx * 0.6 + (dx / dt) * 0.4;
    vy = vy * 0.6 + (dy / dt) * 0.4;
    lastT = e.timeStamp;
    pts.set(e.pointerId, { x: nx, y: ny });
  };

  const up = (e: PointerEvent) => {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    if (dragging) eatClick = true;
    if (pts.size === 1) {
      // one finger left after a pinch: it drags on from where it is
      pinch = null;
      vx = vy = 0;
      const [q] = [...pts.values()];
      start = { ...q };
      lastT = e.timeStamp;
      return;
    }
    if (pts.size) return;
    pinch = null;
    const b = box;
    // a flick glides on and slows down; a finger that stopped before lifting does not
    if (b && dragging && e.timeStamp - lastT < 80 && Math.hypot(vx, vy) > 0.25) {
      let t0 = performance.now();
      const step = (t: number) => {
        const dt = Math.min(40, t - t0);
        t0 = t;
        b.scrollLeft -= vx * dt;
        b.scrollTop -= vy * dt;
        const k = Math.pow(0.94, dt / 16);
        vx *= k;
        vy *= k;
        glide = Math.hypot(vx, vy) > 0.02 && b.isConnected ? requestAnimationFrame(step) : 0;
      };
      glide = requestAnimationFrame(step);
    }
  };

  // a drag ends without a tap on whatever node it began on
  const click = (e: MouseEvent) => {
    if (!eatClick) return;
    eatClick = false;
    if (!mapOf(e.target)) return;
    e.stopPropagation();
    e.preventDefault();
  };

  // ctrl + the wheel (and a trackpad's pinch, which comes as one) zooms around the pointer
  const wheel = (e: WheelEvent) => {
    const b = mapOf(e.target);
    if (!b || !e.ctrlKey) return;
    e.preventDefault();
    stopGlide();
    const at = { x: e.clientX, y: e.clientY };
    const { u, v } = mapPoint(b, at);
    zoomAt(b, host.px() * Math.exp(-e.deltaY * 0.01), u, v, at);
  };

  root.addEventListener('pointerdown', down);
  root.addEventListener('pointermove', move, { passive: false });
  root.addEventListener('pointerup', up);
  root.addEventListener('pointercancel', up);
  root.addEventListener('click', click, true);
  root.addEventListener('wheel', wheel, { passive: false });
  return () => {
    stopGlide();
    root.removeEventListener('pointerdown', down);
    root.removeEventListener('pointermove', move);
    root.removeEventListener('pointerup', up);
    root.removeEventListener('pointercancel', up);
    root.removeEventListener('click', click, true);
    root.removeEventListener('wheel', wheel);
  };
}

/** Zoom the map by `factor` around the middle of what it shows (the − and + buttons). */
export function zoomTreeBy(root: HTMLElement, host: TreeZoomHost, factor: number): void {
  const b = root.querySelector<HTMLElement>('#dbdTreeMap');
  if (!b) return;
  const r = b.getBoundingClientRect();
  const at = { x: r.left + b.clientWidth / 2, y: r.top + b.clientHeight / 2 };
  const svg = b.querySelector('svg');
  const s = svg ? svg.getBoundingClientRect() : r;
  const u = (at.x - s.left) / Math.max(1, s.width),
    v = (at.y - s.top) / Math.max(1, s.height);
  host.setPx(host.px() * factor);
  const s2 = svg ? svg.getBoundingClientRect() : r;
  b.scrollLeft += s2.left + u * s2.width - at.x;
  b.scrollTop += s2.top + v * s2.height - at.y;
}
