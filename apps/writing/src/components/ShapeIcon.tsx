import type { ShapeKind } from '../lib/shapes';

export default function ShapeIcon({ kind, size = 20 }: { kind: ShapeKind; size?: number }) {
  const p = {
    width: size, height: size,
    viewBox: '0 0 20 20',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.65,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  switch (kind) {
    case 'circle':    return <svg {...p}><circle cx="10" cy="10" r="7"/></svg>;
    case 'rectangle': return <svg {...p}><rect x="2.5" y="5.5" width="15" height="9" rx="1.5"/></svg>;
    case 'triangle':  return <svg {...p}><path d="M10 3L17.5 16.5H2.5Z"/></svg>;
    case 'diamond':   return <svg {...p}><path d="M10 2L18 10L10 18L2 10Z"/></svg>;
    case 'pentagon':  return <svg {...p}><polygon points="10,2.5 17.1,7.7 14.4,16.1 5.6,16.1 2.9,7.7"/></svg>;
    case 'hexagon':   return <svg {...p}><polygon points="10,2.5 16.5,6.25 16.5,13.75 10,17.5 3.5,13.75 3.5,6.25"/></svg>;
    case 'star':      return <svg {...p}><polygon points="10,2.5 11.8,7.6 17.1,7.7 12.85,10.93 14.4,16.1 10,13 5.6,16.1 7.15,10.93 2.9,7.7 8.24,7.57"/></svg>;
    case 'line':      return <svg {...p}><line x1="2" y1="10" x2="18" y2="10"/></svg>;
    case 'arrow':     return <svg {...p}><line x1="2" y1="10" x2="15.5" y2="10"/><polyline points="12,6.5 15.5,10 12,13.5"/></svg>;
    case 'cloud':     return <svg {...p} viewBox="0 0 16 16"><path d="M 4.8,12 H 11.2 C 12.9,12 14.3,10.8 14.3,9.3 C 14.3,7.9 13.3,6.9 12,6.7 C 11.6,5.2 10.3,4.1 8.6,4.1 C 7.1,4.1 5.9,5 5.3,6.3 C 3.7,6.5 2.5,7.7 2.5,9.2 C 2.5,10.8 3.7,12 4.8,12 Z"/></svg>;
    default:          return null;
  }
}
