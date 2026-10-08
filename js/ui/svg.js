/** Primitivas das figuras em SVG (mesmo estilo dos simuladores cpu e dlp). */

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function text(x, y, s, cls = '', extra = '') {
    return `<text x="${x}" y="${y}" class="${cls}" ${extra}>${esc(s)}</text>`;
}

export function box(x, y, w, h, cls = '', extra = '', rx = 4) {
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" class="${cls}" ${extra}/>`;
}

/** Cabeça de seta com a ponta em (x, y), apontando no ângulo a (radianos). */
export function head(x, y, a, cls = '') {
    const s = 8, w = 4.5;
    const bx = x - s * Math.cos(a), by = y - s * Math.sin(a);
    const px = -Math.sin(a) * w, py = Math.cos(a) * w;
    return `<path class="head ${cls}" d="M${x.toFixed(1)},${y.toFixed(1)} L${(bx + px).toFixed(1)},${(by + py).toFixed(1)} L${(bx - px).toFixed(1)},${(by - py).toFixed(1)} Z"/>`;
}

/** Fio reto em polilinha, com seta na ponta. */
export function wire(points, cls = '', withHead = true) {
    let out = `<polyline class="wire ${cls}" points="${points.map(([x, y]) => `${x},${y}`).join(' ')}"/>`;
    if (withHead && points.length >= 2) {
        const [x1, y1] = points[points.length - 2], [x2, y2] = points[points.length - 1];
        out += head(x2, y2, Math.atan2(y2 - y1, x2 - x1), cls);
    }
    return out;
}

/** Rótulo com fundo da cor do painel (largura estimada pelo número de caracteres). */
export function label(x, y, s, cls = '', size = 11) {
    const w = String(s).length * size * 0.56 + 6, h = size + 5;
    return `<rect x="${(x - w / 2).toFixed(1)}" y="${(y - h / 2 - 1).toFixed(1)}" width="${w.toFixed(1)}" height="${h}" rx="3" class="lblbg"/>`
        + text(x.toFixed(1), y.toFixed(1), s, `lbl ${cls}`, 'text-anchor="middle" dominant-baseline="middle"');
}
