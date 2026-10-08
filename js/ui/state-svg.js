/**
 * Diagrama de estados do protocolo (MSI, MESI ou MOESI) no estilo do Patterson e Hennessy: um círculo por
 * estado; setas cheias para as ações do processador (PrRd, PrWr) e tracejadas para o que a cache observa
 * no barramento (BusRd, BusRdX, BusUpgr). No passo atual, a transição do núcleo que acessa acende em azul
 * e as transições das outras caches, provocadas pelo barramento, em laranja. Ao lado de cada estado, os
 * núcleos que guardam o bloco nesse estado depois do passo.
 */
import { text, head, label, esc } from './svg.js';
import { t as tr } from '../i18n/index.js';

const W = 680, H = 520, R = 32;

const POS = {
    msi: { M: [340, 120], S: [550, 385], I: [130, 385] },
    mesi: { M: [270, 120], E: [530, 120], I: [140, 395], S: [440, 395] },
    moesi: { O: [110, 120], M: [340, 120], E: [570, 120], I: [200, 395], S: [480, 395] },
};

// Rótulos traduzidos na hora de desenhar.
const RD_SHARED = '@withCopies', RD_ALONE = '@alone';
const labelText = (s) => (s === RD_SHARED ? tr('svg.withCopies') : s === RD_ALONE ? tr('svg.alone') : s);
const EDGES = {
    msi: [
        ['I', 'S', 'cpu', 'PrRd/BusRd'], ['I', 'M', 'cpu', 'PrWr/BusRdX'], ['S', 'M', 'cpu', 'PrWr/BusUpgr'],
        ['S', 'I', 'bus', 'BusRdX, BusUpgr'], ['M', 'S', 'bus', 'BusRd/Flush'], ['M', 'I', 'bus', 'BusRdX/Flush'],
        ['M', 'M', 'cpu', 'PrRd, PrWr'], ['S', 'S', 'cpu', 'PrRd'], ['S', 'S', 'bus', 'BusRd'],
    ],
    mesi: [
        ['I', 'S', 'cpu', RD_SHARED], ['I', 'E', 'cpu', RD_ALONE], ['I', 'M', 'cpu', 'PrWr/BusRdX'],
        ['S', 'M', 'cpu', 'PrWr/BusUpgr'], ['E', 'M', 'cpu', 'PrWr'],
        ['S', 'I', 'bus', 'BusRdX, BusUpgr'], ['E', 'S', 'bus', 'BusRd'], ['E', 'I', 'bus', 'BusRdX'],
        ['M', 'S', 'bus', 'BusRd/Flush'], ['M', 'I', 'bus', 'BusRdX/Flush'],
        ['M', 'M', 'cpu', 'PrRd, PrWr'], ['E', 'E', 'cpu', 'PrRd'], ['S', 'S', 'cpu', 'PrRd'], ['S', 'S', 'bus', 'BusRd'],
    ],
    moesi: [
        ['I', 'S', 'cpu', RD_SHARED], ['I', 'E', 'cpu', RD_ALONE], ['I', 'M', 'cpu', 'PrWr/BusRdX'],
        ['S', 'M', 'cpu', 'PrWr/BusUpgr'], ['E', 'M', 'cpu', 'PrWr'], ['O', 'M', 'cpu', 'PrWr/BusUpgr'],
        ['S', 'I', 'bus', 'BusRdX, BusUpgr'], ['E', 'S', 'bus', 'BusRd'], ['E', 'I', 'bus', 'BusRdX'],
        ['M', 'O', 'bus', 'BusRd/Flush'], ['M', 'I', 'bus', 'BusRdX/Flush'], ['O', 'I', 'bus', 'BusRdX/Flush, BusUpgr'],
        ['M', 'M', 'cpu', 'PrRd, PrWr'], ['E', 'E', 'cpu', 'PrRd'], ['S', 'S', 'cpu', 'PrRd'], ['S', 'S', 'bus', 'BusRd'],
        ['O', 'O', 'cpu', 'PrRd'], ['O', 'O', 'bus', 'BusRd/Flush'],
    ],
};

/** Transições do passo: a do núcleo que acessa (processador) e as das caches que observam o barramento. */
export function stepTransitions(step) {
    if (!step || step.hit === null) return { cpu: null, bus: [] };
    const me = step.core;
    const cpu = { from: step.before[me], to: step.after[me], shared: step.after.some((s, c) => c !== me && s !== 'I') };
    const bus = [];
    if (step.bus) step.before.forEach((b, c) => { if (c !== me && b !== 'I') bus.push({ core: c, from: b, to: step.after[c] }); });
    return { cpu, bus };
}

/** Pontos da curva de a para b (quadrática, aparada nos círculos), para setas e rótulos. */
function curve([x1, y1], [x2, y2], bend, t = 0.5, lw = 0) {
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
    const nx = -dy / len, ny = dx / len;
    const cx = mx + nx * bend, cy = my + ny * bend;
    const trim = ([px, py], [qx, qy], r) => { const d = Math.hypot(qx - px, qy - py); return [px + (qx - px) / d * r, py + (qy - py) / d * r]; };
    const p0 = trim([x1, y1], [cx, cy], R + 2), p2 = trim([x2, y2], [cx, cy], R + 3);
    const u = 1 - t;
    const lx = u * u * p0[0] + 2 * u * t * cx + t * t * p2[0], ly = u * u * p0[1] + 2 * u * t * cy + t * t * p2[1];
    // Afasta o rótulo da curva pela metade da sua extensão na direção normal (largura lw, altura 16).
    const off = 5 + Math.abs(nx) * lw / 2 + Math.abs(ny) * 8;
    const sg = bend >= 0 ? 1 : -1;
    return { p0, c: [cx, cy], p2, lab: [lx + sg * nx * off, ly + sg * ny * off], ang: Math.atan2(p2[1] - cy, p2[0] - cx) };
}

/**
 * @param {string} protocol msi, mesi ou moesi
 * @param {object|null} step passo do simulate (ou null antes do primeiro passo)
 * @param {number} cores
 */
export function stateSvg(protocol, step, cores) {
    const pos = POS[protocol], edges = EDGES[protocol];
    const cxAll = Object.values(pos).reduce((s, p) => s + p[0], 0) / Object.keys(pos).length;
    const cyAll = Object.values(pos).reduce((s, p) => s + p[1], 0) / Object.keys(pos).length;
    const { cpu, bus } = stepTransitions(step);
    const isOn = (e) => cpu && e[2] === 'cpu' && e[0] === cpu.from && e[1] === cpu.to
        && (e[3] !== RD_SHARED || cpu.shared) && (e[3] !== RD_ALONE || !cpu.shared);
    const isSnp = (e) => e[2] === 'bus' && bus.some((t) => t.from === e[0] && t.to === e[1]);
    const out = [];
    const lbls = [];
    // Caixas já ocupadas (estados e rótulos), para que os rótulos das setas não se sobreponham.
    const placed = Object.values(pos).map(([x, y]) => [x - R, y - R, 2 * R, 2 * R]);
    const lw = (s) => s.length * 11 * 0.56 + 6;
    const overlap = ([x, y, w, h]) => placed.reduce((sum, [X, Y, Wd, Hd]) => sum
        + Math.max(0, Math.min(x + w, X + Wd) - Math.max(x, X) + 3) * Math.max(0, Math.min(y + h, Y + Hd) - Math.max(y, Y) + 3), 0);
    const dist = (e) => Math.hypot(pos[e[1]][0] - pos[e[0]][0], pos[e[1]][1] - pos[e[0]][1]);
    // Laços primeiro, depois as setas curtas e, por último, as diagonais longas, que têm mais lugar livre.
    const ordered = [...edges.filter((e) => e[0] === e[1]), ...edges.filter((e) => e[0] !== e[1]).sort((p, q) => dist(p) - dist(q))];
    for (const e of ordered) {
        const [a, b, kind] = e, lab = labelText(e[3]);
        const cls = `${kind === 'bus' ? 'snoop' : ''} ${isOn(e) ? 'on' : isSnp(e) ? 'snp' : ''}`;
        if (a === b) {
            // Laço para fora do diagrama: processador de um lado, barramento do outro.
            const [x, y] = pos[a];
            const out0 = Math.atan2(y - cyAll, x - cxAll) + (kind === 'cpu' ? -0.62 : 0.62);
            const a1 = out0 - 0.42, a2 = out0 + 0.42, far = R + 46;
            const s1 = [x + R * Math.cos(a1), y + R * Math.sin(a1)], s2 = [x + (R + 2) * Math.cos(a2), y + (R + 2) * Math.sin(a2)];
            const c1 = [x + far * Math.cos(a1 - 0.25), y + far * Math.sin(a1 - 0.25)], c2 = [x + far * Math.cos(a2 + 0.25), y + far * Math.sin(a2 + 0.25)];
            out.push(`<path class="edge ${cls}" d="M${s1[0].toFixed(1)},${s1[1].toFixed(1)} C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${s2[0].toFixed(1)},${s2[1].toFixed(1)}"/>`);
            out.push(head(s2[0], s2[1], Math.atan2(s2[1] - c2[1], s2[0] - c2[0]), cls));
            const ld = far + 4, lx = x + ld * Math.cos(out0), ly = y + ld * Math.sin(out0);
            placed.push([lx - lw(lab) / 2, ly - 8, lw(lab), 16]);
            lbls.push(label(lx, ly, lab, cls));
            continue;
        }
        const rev = edges.some((f) => f[0] === b && f[1] === a);
        const len = Math.hypot(pos[b][0] - pos[a][0], pos[b][1] - pos[a][1]);
        // Pares de ida e volta curvam para lados opostos; nas diagonais longas o rótulo fica mais perto da origem.
        const t0 = len > 400 ? 0.3 : rev ? 0.45 : 0.5;
        const bend = rev ? 34 : 14;
        let k = null, best = Infinity;
        for (const d of [0, 0.08, -0.08, 0.16, -0.16, 0.24, -0.24, 0.32, -0.32, 0.4]) {
            const t = t0 + d;
            if (t < 0.15 || t > 0.85) continue;
            const c = curve(pos[a], pos[b], bend, t, lw(lab));
            const o = overlap([c.lab[0] - lw(lab) / 2, c.lab[1] - 8, lw(lab), 16]);
            if (o < best) { best = o; k = c; }
            if (o === 0) break;
        }
        placed.push([k.lab[0] - lw(lab) / 2, k.lab[1] - 8, lw(lab), 16]);
        out.push(`<path class="edge ${cls}" d="M${k.p0[0].toFixed(1)},${k.p0[1].toFixed(1)} Q${k.c[0].toFixed(1)},${k.c[1].toFixed(1)} ${k.p2[0].toFixed(1)},${k.p2[1].toFixed(1)}"/>`);
        out.push(head(k.p2[0], k.p2[1], k.ang, cls));
        lbls.push(label(k.lab[0], k.lab[1], lab, cls));
    }
    // Estados, com os núcleos que guardam o bloco em cada um depois do passo.
    const nodes = [];
    for (const [s, [x, y]] of Object.entries(pos)) {
        const who = step ? step.after.map((v, c) => (v === s ? `P${c}` : null)).filter(Boolean) : [];
        const cur = cpu && cpu.to === s;
        nodes.push(`<circle cx="${x}" cy="${y}" r="${R}" class="state st${s} ${cur ? 'cur' : ''}"/>`);
        nodes.push(text(x, who.length ? y - 6 : y + 1, s, 'stname', 'text-anchor="middle" dominant-baseline="middle"'));
        if (who.length) nodes.push(text(x, y + 15, who.join(' '), 'who', 'text-anchor="middle" dominant-baseline="middle"'));
    }
    // Título e legenda.
    const title = !step ? tr('svg.before') : step.hit === null ? `P${step.core}: ${step.text ?? ''} (${tr('svg.noAccess')})`
        : `${tr('svg.access', { c: step.core, verb: tr(step.kind === 'R' ? 'acc.read' : 'acc.write'), addr: `0x${step.addr.toString(16)}`, b: step.block })}: ${step.bus ?? tr('svg.noBus')}`;
    const legend = [
        `<line x1="14" y1="${H - 34}" x2="44" y2="${H - 34}" class="edge"/>`, text(50, H - 30, tr('svg.legCpu'), 'leg'),
        `<line x1="210" y1="${H - 34}" x2="240" y2="${H - 34}" class="edge snoop"/>`, text(246, H - 30, tr('svg.legBus'), 'leg'),
        `<line x1="14" y1="${H - 14}" x2="44" y2="${H - 14}" class="edge on"/>`, text(50, H - 10, `${tr('svg.legMe')}${step && step.hit !== null ? ` (P${step.core})` : ''}`, 'leg'),
        `<line x1="210" y1="${H - 14}" x2="240" y2="${H - 14}" class="edge snp"/>`, text(246, H - 10, tr('svg.legOthers'), 'leg'),
        text(430, H - 30, tr('svg.legFlush'), 'leg'),
        text(430, H - 10, tr(protocol === 'moesi' ? 'svg.legFlushOwner' : 'svg.legFlushMem'), 'leg'),
    ];
    return `<svg xmlns="http://www.w3.org/2000/svg" class="fig-svg" data-figure="estados" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(tr('svg.fsmAria', { p: protocol.toUpperCase() }))}">`
        + text(14, 22, `${protocol.toUpperCase()} · ${title}`, 'title')
        + out.join('') + nodes.join('') + lbls.join('') + legend.join('') + '</svg>';
}
