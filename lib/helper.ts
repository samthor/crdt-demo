import { hashCode, seeded32 } from 'thorish';

export function splitNode(n: string): { s: string; n: number } {
  const m = /\d+/.exec(n);
  if (!m) {
    return { s: n, n: 0 };
  }

  const offset = m.index;

  return {
    s: n.slice(0, offset),
    n: +n.slice(offset),
  };
}

export function colorForNode(id: string, opacity = 1.0) {
  const { s } = splitNode(id);

  const r = seeded32(hashCode(s));
  const hue = r() % 360;

  return `hsla(${hue}, 90%, 40%, ${opacity})`;
}

export function buildWindowCanvas() {
  const c = document.createElement('canvas');
  document.body.append(c);

  const sizeCanvas = () => {
    c.width = window.innerWidth * window.devicePixelRatio;
    c.height = window.innerHeight * window.devicePixelRatio;

    c.style.display = 'block';
    c.style.width = `${window.innerWidth}px`;
    c.style.height = `${window.innerHeight}px`;
  };

  window.addEventListener('resize', sizeCanvas);
  sizeCanvas();

  return c;
}
