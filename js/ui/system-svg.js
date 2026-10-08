/**
 * Figura do sistema no passo atual: núcleos, caches privadas (todas as linhas, com bloco e estado), o
 * barramento compartilhado (linhas de endereço/comando e de dados) e a memória. O núcleo que acessa pede a
 * transação (azul), as outras caches observam (laranja), e o caminho dos dados acende em verde; escritas na
 * memória (flush e write-back) aparecem em vermelho.
 */
import { text, box, wire, label, esc } from './svg.js';
import { t } from '../i18n/index.js';

const COL = 200, ROW = 16;

/**
 * @param {object|null} step passo do simulate
 * @param {{protocol: string, cores: number, lines: number, blockSize: number}} cfg
 * @param {number} index número do passo (1 em diante; 0 antes do primeiro)
 */
export function systemSvg(step, cfg, index) {
    const { cores, lines } = cfg;
    const W = cores * COL + 40;
    const cacheY = 110, cacheH = 26 + lines * ROW;
    const busY = cacheY + cacheH + 46, dataY = busY + 20;
    const memY = dataY + 46, H = memY + 92;
    const x0 = (c) => 20 + c * COL + 10, cw = COL - 20;
    const me = step?.core;
    const active = step && step.hit !== null && step.bus;
    const snoopers = active ? step.before.map((b, c) => (c !== me && b !== 'I' ? c : null)).filter((c) => c !== null) : [];
    const src = active && step.from && step.from !== 'mem' ? Number(step.from.slice(1)) : null;
    const flush = step?.notes?.includes('flush');
    const out = [];
    const memX = W / 2 - 130, memW = 260;
    const cmdX = (c) => x0(c) + 50, datX = (c) => x0(c) + cw - 50;
    const memCmdX = memX + 60, memDatX = memX + memW - 60;

    // Barramento: linha de endereço/comando e linha de dados.
    out.push(`<line x1="20" y1="${busY}" x2="${W - 20}" y2="${busY}" class="bus ${active ? 'on' : ''}"/>`);
    out.push(`<line x1="20" y1="${dataY}" x2="${W - 20}" y2="${dataY}" class="bus ${active && step.from ? 'data' : ''}"/>`);
    out.push(text(W - 22, busY - 6, t('svg.busCmd'), 'small', 'text-anchor="end"'));
    out.push(text(W - 22, dataY + 14, t('svg.busData'), 'small', 'text-anchor="end"'));
    if (active) out.push(label((cmdX(me) + (me === cores - 1 ? cmdX(0) : cmdX(me + 1))) / 2, busY, step.bus, 'on'));

    for (let c = 0; c < cores; c++) {
        const x = x0(c);
        const lines_ = step ? step.caches[c] : Array.from({ length: lines }, () => ({ block: null, state: 'I' }));
        const isMe = c === me && step?.hit !== null && step;
        // Processador.
        out.push(box(x + 20, 30, cw - 40, 44, `blk ${isMe ? 'act' : ''}`));
        out.push(text(x + cw / 2, 48, `P${c}`, 'bold', 'text-anchor="middle"'));
        if (isMe || (step && c === me)) {
            const act = step.text ?? `${t(step.kind === 'R' ? 'acc.read' : 'acc.write')} 0x${step.addr.toString(16)}`;
            out.push(text(x + cw / 2, 66, act.length > 24 ? `${act.slice(0, 23)}…` : act, 'mono small', 'text-anchor="middle"'));
        }
        out.push(wire([[x + cw / 2, 74], [x + cw / 2, cacheY]], isMe ? 'on' : '', false));
        // Cache: linha, bloco, estado.
        const inv = step && step.before[c] !== 'I' && step.after[c] === 'I';
        out.push(box(x, cacheY, cw, cacheH, `blk ${inv ? 'inv' : ''}`));
        out.push(text(x + 8, cacheY + 16, t('svg.cache', { c }), 'bold small'));
        if (inv) out.push(text(x + cw - 8, cacheY + 16, t('svg.invalidated'), 'small warn', 'text-anchor="end"'));
        else if (step && step.before[c] !== step.after[c] && c !== me) out.push(text(x + cw - 8, cacheY + 16, `${step.before[c]}→${step.after[c]}`, 'small snptxt', 'text-anchor="end"'));
        lines_.forEach((l, i) => {
            const y = cacheY + 24 + i * ROW;
            const cur = step && i === step.block % lines;
            if (cur) out.push(box(x + 2, y, cw - 4, ROW, 'rowhl', '', 2));
            out.push(text(x + 10, y + 12, `${i}`, 'mono small muted'));
            out.push(text(x + 34, y + 12, l.block === null ? t('svg.empty') : t('svg.block', { b: l.block }), `mono small ${l.state === 'I' ? 'muted' : ''}`));
            out.push(box(x + cw - 34, y + 2, 24, ROW - 4, `chip st${l.state}`, '', 3));
            out.push(text(x + cw - 22, y + 12, l.state, `chipt t${l.state}`, 'text-anchor="middle"'));
        });
        // Ligações com o barramento.
        const cy = cacheY + cacheH;
        if (active && c === me) out.push(wire([[cmdX(c), cy], [cmdX(c), busY]], 'on'));
        else if (snoopers.includes(c)) out.push(wire([[cmdX(c), busY], [cmdX(c), cy]], 'snp'));
        else out.push(wire([[cmdX(c), cy], [cmdX(c), busY]], '', false));
        if (active && step.from && c === me) out.push(wire([[datX(c), dataY], [datX(c), cy]], 'data'));
        else if (src === c) out.push(wire([[datX(c), cy], [datX(c), dataY]], 'data'));
        else if (step?.wb !== null && step?.wb !== undefined && c === me) out.push(wire([[datX(c), cy], [datX(c), dataY]], 'wb'));
        else out.push(wire([[datX(c), cy], [datX(c), dataY]], '', false));
        out.push(`<circle cx="${cmdX(c)}" cy="${busY}" r="2.5" class="dot"/><circle cx="${datX(c)}" cy="${dataY}" r="2.5" class="dot"/>`);
    }

    // Memória.
    const memSends = active && step.from === 'mem';
    const memGets = flush || (step?.wb !== null && step?.wb !== undefined);
    out.push(box(memX, memY, memW, 50, 'blk'));
    out.push(text(memX + memW / 2, memY + 20, t('svg.memory'), 'bold', 'text-anchor="middle"'));
    const memNote = !step ? '' : memSends ? t('svg.memSends', { b: step.block }) : flush && step.wb !== null ? t('svg.memFlushWb', { b: step.wb })
        : flush ? t('svg.memFlush', { b: step.block }) : step.wb !== null ? t('svg.memWb', { b: step.wb }) : '';
    out.push(text(memX + memW / 2, memY + 38, memNote, `small ${memGets ? 'warn' : ''}`, 'text-anchor="middle"'));
    out.push(wire([[memCmdX, busY], [memCmdX, memY]], memSends ? 'snp' : '', memSends));
    out.push(`<circle cx="${memCmdX}" cy="${busY}" r="2.5" class="dot"/>`);
    if (memSends) out.push(wire([[memDatX, memY], [memDatX, dataY]], 'data'));
    else if (memGets) out.push(wire([[memDatX, dataY], [memDatX, memY]], 'wb'));
    else out.push(wire([[memDatX, dataY], [memDatX, memY]], '', false));
    out.push(`<circle cx="${memDatX}" cy="${dataY}" r="2.5" class="dot"/>`);

    // Título.
    const res = !step ? t('svg.initial') : step.hit === null ? t('svg.scfail')
        : `${t(step.hit ? 'res.hit' : 'res.miss')}, ${step.bus ?? t('svg.noBus')}${step.from ? `, ${t('svg.dataFrom', { f: step.from === 'mem' ? t('from.mem') : step.from })}` : ''}`;
    const title = `${cfg.protocol.toUpperCase()} · ${t('svg.step', { i: index })}${step ? ` · P${step.core}` : ''}: ${res}`;
    return `<svg xmlns="http://www.w3.org/2000/svg" class="fig-svg" data-figure="sistema" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(title)}">`
        + text(14, 18, title, 'title') + out.join('') + '</svg>';
}
