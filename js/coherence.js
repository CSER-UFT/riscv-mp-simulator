/**
 * Coerência de cache por snooping em barramento atômico: MSI, MESI e MOESI.
 *
 * Cada núcleo tem uma cache privada com mapeamento direto e write-back. Uma sequência de acessos (núcleo,
 * leitura ou escrita, endereço) é aplicada em ordem; para cada acesso, o motor registra acerto ou falha, a
 * transação no barramento (BusRd, BusRdX, BusUpgr), de onde vieram os dados, as escritas na memória e o
 * estado do bloco em todas as caches antes e depois.
 *
 * Simplificações: o barramento atende uma transação por vez (sem corridas); nos protocolos MSI e MESI os
 * dados vêm da memória, exceto quando outra cache tem o bloco modificado (ela o envia e atualiza a memória);
 * no MOESI, o dono (M ou O) envia o bloco sem escrever na memória.
 */

import { t } from './i18n/index.js';

export const PROTOCOLS = ['msi', 'mesi', 'moesi'];

/** Lê a sequência de acessos: uma linha por acesso, "P0 R 0x10" ou "1 w 16"; # inicia comentário. */
export function parseTrace(text, cores) {
    const ops = [], errors = [];
    text.split('\n').forEach((raw, i) => {
        const line = raw.replace(/#.*/, '').trim();
        if (!line) return;
        const m = line.match(/^p?(\d+)\s*[,:\s]\s*(r|w|l|s|ld|st|lw|sw|read|write)\s*[,\s]\s*(0x[0-9a-f]+|\d+)$/i);
        if (!m) { errors.push({ line: i + 1, text: raw }); return; }
        const core = Number(m[1]);
        if (core >= cores) { errors.push({ line: i + 1, text: raw }); return; }
        const kind = /^(r|l|ld|lw|read)$/i.test(m[2]) ? 'R' : 'W';
        ops.push({ core, kind, addr: Number(m[3]), line: i + 1 });
    });
    return { ops, errors };
}

/**
 * Executa a sequência.
 * @param {{protocol: string, cores: number, blockSize: number, lines: number}} cfg
 * @returns {{steps: object[], stats: object}}
 */
export function simulate(ops, cfg) {
    const { protocol, cores, blockSize, lines } = cfg;
    const mesi = protocol !== 'msi', moesi = protocol === 'moesi';
    // caches[c][linha] = {block, state}
    const caches = Array.from({ length: cores }, () => Array.from({ length: lines }, () => ({ block: null, state: 'I' })));
    const stats = { hits: 0, misses: 0, bus: { BusRd: 0, BusRdX: 0, BusUpgr: 0 }, memReads: 0, memWrites: 0, c2c: 0, invalidations: 0 };
    const stateOf = (c, block) => { const l = caches[c][block % lines]; return l.block === block ? l.state : 'I'; };
    const setState = (c, block, state) => { caches[c][block % lines] = { block: state === 'I' && caches[c][block % lines].block !== block ? caches[c][block % lines].block : block, state }; };
    const steps = [];
    const snapshot = () => caches.map((c) => c.map((l) => ({ ...l })));
    for (const op of ops) {
        const block = Math.floor(op.addr / blockSize);
        const before = Array.from({ length: cores }, (_, c) => stateOf(c, block));
        // Instrução sem acesso à memória (por exemplo, sc.w que falhou): registrada, sem mudar nada.
        if (op.kind === 'N') {
            steps.push({ ...op, block, word: op.addr % blockSize, hit: null, bus: null, from: null, wb: null, notes: [], before, after: [...before], caches: snapshot() });
            continue;
        }
        const notes = [];
        let bus = null, from = null, wb = null;
        const me = op.core;
        const line = caches[me][block % lines];
        const mine = before[me];
        const hit = op.kind === 'R' ? mine !== 'I' : mine === 'M' || mine === 'E';
        // Substituição: o bloco que ocupa a linha sai; se estiver sujo (M ou O), é escrito na memória.
        if (mine === 'I' && line.block !== null && line.block !== block && line.state !== 'I') {
            if (line.state === 'M' || line.state === 'O') { wb = line.block; stats.memWrites++; notes.push('wb'); }
            caches[me][block % lines] = { block: null, state: 'I' };
        }
        const others = [...Array(cores).keys()].filter((c) => c !== me);
        if (op.kind === 'R') {
            if (mine !== 'I') { stats.hits++; }
            else {
                stats.misses++; bus = 'BusRd';
                const owner = others.find((c) => ['M', 'O'].includes(before[c]) || (!moesi && before[c] === 'M'));
                if (owner !== undefined && (before[owner] === 'M' || before[owner] === 'O')) {
                    from = `P${owner}`; stats.c2c++;
                    if (moesi) setState(owner, block, 'O');
                    else { setState(owner, block, 'S'); stats.memWrites++; notes.push('flush'); }
                } else { from = 'mem'; stats.memReads++; }
                for (const c of others) if (before[c] === 'E') setState(c, block, 'S');
                const shared = others.some((c) => before[c] !== 'I');
                setState(me, block, mesi && !shared ? 'E' : 'S');
            }
        } else if (mine === 'M') { stats.hits++; }
        else if (mine === 'E') { stats.hits++; setState(me, block, 'M'); notes.push('silent'); }
        else {
            stats.misses++;
            bus = mine === 'I' ? 'BusRdX' : 'BusUpgr';
            if (mine === 'I') {
                const owner = others.find((c) => before[c] === 'M' || before[c] === 'O');
                if (owner !== undefined) {
                    from = `P${owner}`; stats.c2c++;
                    if (!moesi) { stats.memWrites++; notes.push('flush'); }
                } else { from = 'mem'; stats.memReads++; }
            }
            for (const c of others) if (before[c] !== 'I') { setState(c, block, 'I'); stats.invalidations++; }
            setState(me, block, 'M');
        }
        if (bus) stats.bus[bus]++;
        const after = Array.from({ length: cores }, (_, c) => stateOf(c, block));
        steps.push({ ...op, block, word: op.addr % blockSize, hit, bus, from, wb, notes, before, after, caches: snapshot() });
    }
    stats.busTotal = stats.bus.BusRd + stats.bus.BusRdX + stats.bus.BusUpgr;
    return { steps, stats };
}

/** Tabela LaTeX dos passos (cabeçalho tabAzul, \hline, sem booktabs). */
export function latexTable(steps, cfg) {
    const hx = (n) => `0x${n.toString(16)}`;
    const head = ['\\#', t('tex.access'), t('tex.block'), t('tex.result'), t('tex.bus'), t('tex.from'), ...Array.from({ length: cfg.cores }, (_, c) => `P${c}`)];
    const rows = steps.map((s, i) => [i + 1, s.text ? `P${s.core}: \\texttt{${s.text}}` : `P${s.core} ${t(s.kind === 'R' ? 'acc.read' : 'acc.write')} ${hx(s.addr)}`, s.block, s.hit === null ? t('tex.noAccess') : t(s.hit ? 'res.hit' : 'res.miss'), s.bus ?? '-', s.from === 'mem' ? t('from.mem') : s.from ?? '-', ...s.after].join(' & ') + ' \\\\ \\hline');
    return ['% Requer \\usepackage[table]{xcolor}; tabAzul definida abaixo se ainda não existir.', '\\providecolor{tabAzul}{HTML}{1F4E79}',
        '\\begin{table}[htbp]', '\\centering', `\\begin{tabular}{|${'c|'.repeat(head.length)}}`, '\\hline',
        `\\rowcolor{tabAzul}${head.map((h) => `\\color{white}\\textbf{${h}}`).join(' & ')} \\\\ \\hline`, ...rows,
        '\\end{tabular}', `\\caption{${t('tex.caption', { p: cfg.protocol.toUpperCase(), n: cfg.cores, b: cfg.blockSize })}}`, '\\end{table}', ''].join('\n');
}
