/**
 * Programas RISC-V (RV32I com a extensão A) executados por vários núcleos sobre uma memória compartilhada.
 *
 * Todos os núcleos rodam o mesmo programa; no início, a0 recebe o número do núcleo (como o mhartid, que
 * também pode ser lido com "csrr rd, mhartid"). Os núcleos são intercalados uma instrução por vez, em
 * rodízio ou em ordem aleatória com semente. Cada acesso à memória de dados vira um passo da sequência
 * entregue ao simulador de coerência: lw e lr.w leem; sw, sc.w (quando consegue) e as AMOs escrevem (a AMO
 * lê e escreve o bloco de uma vez, por isso pede o bloco exclusivo). As instruções não ocupam a memória de
 * dados: a busca de instruções fica fora do modelo.
 *
 * Reserva do lr.w: vale para o endereço lido e se perde quando outro núcleo escreve no mesmo bloco (a
 * invalidação da cópia derruba a reserva) ou quando o próprio núcleo executa sc.w.
 */

import { t } from './i18n/index.js';

const ABI = ['zero', 'ra', 'sp', 'gp', 'tp', 't0', 't1', 't2', 's0', 's1', 'a0', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7',
    's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10', 's11', 't3', 't4', 't5', 't6'];
const REG = Object.fromEntries([...ABI.map((n, i) => [n, i]), ...ABI.map((_, i) => [`x${i}`, i]), ['fp', 8]]);
export const regName = (r) => `x${r} (${ABI[r]})`;

// Formato dos operandos: r registrador, i imediato, l rótulo de instrução, d rótulo de dado, m imm(reg), a (reg).
const FORMS = {
    add: 'rrr', sub: 'rrr', and: 'rrr', or: 'rrr', xor: 'rrr', sll: 'rrr', srl: 'rrr', sra: 'rrr', slt: 'rrr', sltu: 'rrr', mul: 'rrr',
    addi: 'rri', andi: 'rri', ori: 'rri', xori: 'rri', slli: 'rri', srli: 'rri', srai: 'rri', slti: 'rri',
    lw: 'rm', sw: 'rm', beq: 'rrl', bne: 'rrl', blt: 'rrl', bge: 'rrl', bltu: 'rrl', bgeu: 'rrl',
    jal: 'rl', j: 'l', beqz: 'rl', bnez: 'rl', li: 'ri', la: 'rd', mv: 'rr', nop: '', fence: '', ecall: '', csrr: 'rc',
    'lr.w': 'ra', 'sc.w': 'rra', 'amoswap.w': 'rra', 'amoadd.w': 'rra', 'amoand.w': 'rra', 'amoor.w': 'rra', 'amoxor.w': 'rra',
    'amomax.w': 'rra', 'amomin.w': 'rra',
};

/** Mnemônicos aceitos (para o destaque de sintaxe do editor). */
export const isMnemonic = (w) => w.toLowerCase().replace(/\.(aq|rl|aqrl)$/, '').replace(/\.(aq|rl)$/, '') in FORMS;
export const isRegister = (w) => w.toLowerCase() in REG;

/** Instruções que só existem no RV64 (operam com registradores de 64 bits): mensagem didática. */
export const RV64_ONLY = /^(ld|sd|lwu|addiw|addw|subw|slliw|srliw|sraiw|sllw|srlw|sraw|mulw|lr\.d|sc\.d|amo\w+\.d)$/;

function parseNum(t) {
    if (!/^-?(0x[0-9a-f]+|\d+)$/i.test(t)) return null;
    const neg = t.startsWith('-');
    const v = Number(neg ? t.slice(1) : t);
    return neg ? -v : v;
}

/**
 * Monta o programa: seção .data (rótulos, .word, .space, .align) a partir do endereço 0 e seção .text.
 * @returns {{code: object[], data: Map<number, number>, labels: object, dataLabels: object, errors: object[]}}
 */
export function assemble(src) {
    const code = [], data = new Map(), labels = {}, dataLabels = {}, errors = [], pending = [];
    let section = 'text', dp = 0;
    src.split('\n').forEach((raw, i) => {
        const lineNo = i + 1;
        let line = raw.replace(/#.*/, '').trim();
        const err = (msg) => errors.push({ line: lineNo, text: raw.trim(), msg });
        while (true) {
            const m = line.match(/^([A-Za-z_.$][\w.$]*)\s*:\s*(.*)$/);
            if (!m) break;
            if (section === 'data') dataLabels[m[1]] = dp; else labels[m[1]] = code.length;
            line = m[2];
        }
        if (!line) return;
        const [head, ...rest] = line.split(/\s+/);
        const op = head.toLowerCase();
        const argText = rest.join(' ');
        if (op === '.data' || op === '.text') { section = op.slice(1); return; }
        if (op === '.globl' || op === '.global' || op === '.section') return;
        if (section === 'data') {
            if (op === '.word') {
                for (const tok of argText.split(',').map((x) => x.trim()).filter(Boolean)) {
                    const v = parseNum(tok);
                    if (v === null) { err(t('asm.badValue', { t: tok })); return; }
                    data.set(dp, v | 0); dp += 4;
                }
            } else if (op === '.space' || op === '.zero') {
                const n = parseNum(argText.trim());
                if (n === null || n < 0) { err(t('asm.badSize')); return; }
                dp += n;
            } else if (op === '.align' || op === '.balign') {
                const n = parseNum(argText.trim());
                if (n === null || n < 0) { err(t('asm.badAlign')); return; }
                const a = op === '.align' ? 2 ** n : n;
                dp = Math.ceil(dp / a) * a;
            } else err(t('asm.directive', { d: head }));
            dp = Math.ceil(dp / 4) * 4;
            return;
        }
        // Sufixos .aq e .rl das instruções atômicas só tratam da ordem da memória; aqui a ordem já é sequencial.
        const base = op.replace(/\.(aq|rl|aqrl)$/, '').replace(/\.(aq|rl)$/, '');
        if (RV64_ONLY.test(base)) {
            err(t('asm.rv64', { op: base }));
            return;
        }
        const form = FORMS[base];
        if (form === undefined) { err(t('asm.unsupported', { op: head })); return; }
        const args = argText ? argText.split(',').map((x) => x.trim()) : [];
        // lw/sw aceitam "rd, imm(rs1)"; as atômicas, "rd, rs2, (rs1)" ou "rd, (rs1)".
        if (args.length !== form.length) { err(t('asm.operands', { op: base, n: form.length })); return; }
        const ops = [];
        for (let k = 0; k < form.length; k++) {
            const f = form[k], tok = args[k];
            if (f === 'r') {
                const r = REG[tok.toLowerCase()];
                if (r === undefined) { err(t('asm.badReg', { t: tok })); return; }
                ops.push(r);
            } else if (f === 'i') {
                const v = parseNum(tok);
                if (v === null) { err(t('asm.badImm', { t: tok })); return; }
                ops.push(v);
            } else if (f === 'l' || f === 'd') {
                ops.push(tok);
            } else if (f === 'c') {
                if (tok.toLowerCase() !== 'mhartid') { err(t('asm.csrr')); return; }
                ops.push(tok);
            } else {
                const m = tok.match(f === 'm' ? /^(-?(?:0x[0-9a-f]+|\d+))?\s*\(\s*(\w+)\s*\)$/i : /^(0)?\s*\(\s*(\w+)\s*\)$/i);
                const r = m && REG[m[2].toLowerCase()];
                if (r === undefined || r === null) { err(t(f === 'a' ? 'asm.badAddrA' : 'asm.badAddr', { t: tok })); return; }
                ops.push({ off: m[1] ? parseNum(m[1]) : 0, base: r });
            }
        }
        const ins = { op: base, args: ops, line: lineNo, text: line.replace(/\s+/g, ' ') };
        code.push(ins);
        pending.push(ins);
    });
    for (const ins of pending) {
        const form = FORMS[ins.op];
        for (let k = 0; k < form.length; k++) {
            if (form[k] === 'l' && labels[ins.args[k]] === undefined) errors.push({ line: ins.line, text: ins.text, msg: t('asm.label', { l: ins.args[k] }) });
            if (form[k] === 'd' && dataLabels[ins.args[k]] === undefined && labels[ins.args[k]] === undefined) errors.push({ line: ins.line, text: ins.text, msg: t('asm.dataLabel', { l: ins.args[k] }) });
        }
    }
    return { code, data, labels, dataLabels, errors };
}

/** Gerador congruente linear (mesma semente, mesma intercalação). */
function lcg(seed) {
    let s = (seed >>> 0) || 1;
    return (n) => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return (s >>> 16) % n; };
}

/**
 * Executa o programa em vários núcleos.
 * @param {ReturnType<typeof assemble>} prog
 * @param {{cores: number, blockSize: number, schedule?: 'rr'|'random', seed?: number, maxInstr?: number}} cfg
 * @returns {{ops: object[], cores: object[], memory: Map<number, number>}}
 */
export function runPrograms(prog, cfg) {
    const { cores, blockSize, schedule = 'rr', seed = 1, maxInstr = 400 } = cfg;
    const mem = new Map(prog.data);
    const st = Array.from({ length: cores }, (_, id) => {
        const x = new Int32Array(32);
        x[10] = id;
        return { id, x, pc: 0, done: prog.code.length === 0, status: prog.code.length === 0 ? 'fim' : 'executando', instrs: 0, scFails: 0, error: null };
    });
    const res = new Array(cores).fill(null);
    const ops = [];
    const rnd = lcg(seed);
    const block = (a) => Math.floor(a / blockSize);
    const load = (a) => mem.get(a) ?? 0;
    const store = (c, a, v) => {
        mem.set(a, v | 0);
        for (let k = 0; k < cores; k++) if (k !== c && res[k] !== null && block(res[k]) === block(a)) res[k] = null;
    };
    let turn = 0;
    while (st.some((s) => !s.done)) {
        let c;
        if (schedule === 'random') {
            const live = st.filter((s) => !s.done);
            c = live[rnd(live.length)].id;
        } else {
            while (st[turn % cores].done) turn++;
            c = turn % cores; turn++;
        }
        const s = st[c], ins = prog.code[s.pc], x = s.x, a = ins.args;
        const set = (r, v) => { if (r !== 0) x[r] = v | 0; };
        const addrOf = (m) => (x[m.base] + m.off) | 0;
        const mops = { core: c, text: ins.text, line: ins.line, pc: s.pc * 4 };
        let next = s.pc + 1;
        const fail = (msg) => { s.done = true; s.status = 'erro'; s.error = { line: ins.line, msg }; };
        const aligned = (addr) => { if (addr % 4 !== 0 || addr < 0) { fail(t('run.misaligned', { a: `0x${(addr >>> 0).toString(16)}` })); return false; } return true; };
        s.instrs++;
        switch (ins.op) {
            case 'add': set(a[0], x[a[1]] + x[a[2]]); break;
            case 'sub': set(a[0], x[a[1]] - x[a[2]]); break;
            case 'mul': set(a[0], Math.imul(x[a[1]], x[a[2]])); break;
            case 'and': set(a[0], x[a[1]] & x[a[2]]); break;
            case 'or': set(a[0], x[a[1]] | x[a[2]]); break;
            case 'xor': set(a[0], x[a[1]] ^ x[a[2]]); break;
            case 'sll': set(a[0], x[a[1]] << (x[a[2]] & 31)); break;
            case 'srl': set(a[0], x[a[1]] >>> (x[a[2]] & 31)); break;
            case 'sra': set(a[0], x[a[1]] >> (x[a[2]] & 31)); break;
            case 'slt': set(a[0], x[a[1]] < x[a[2]] ? 1 : 0); break;
            case 'sltu': set(a[0], (x[a[1]] >>> 0) < (x[a[2]] >>> 0) ? 1 : 0); break;
            case 'addi': set(a[0], x[a[1]] + a[2]); break;
            case 'andi': set(a[0], x[a[1]] & a[2]); break;
            case 'ori': set(a[0], x[a[1]] | a[2]); break;
            case 'xori': set(a[0], x[a[1]] ^ a[2]); break;
            case 'slli': set(a[0], x[a[1]] << (a[2] & 31)); break;
            case 'srli': set(a[0], x[a[1]] >>> (a[2] & 31)); break;
            case 'srai': set(a[0], x[a[1]] >> (a[2] & 31)); break;
            case 'slti': set(a[0], x[a[1]] < a[2] ? 1 : 0); break;
            case 'li': set(a[0], a[1]); break;
            case 'la': set(a[0], prog.dataLabels[a[1]] ?? (prog.labels[a[1]] ?? 0) * 4); break;
            case 'mv': set(a[0], x[a[1]]); break;
            case 'csrr': set(a[0], c); break;
            case 'nop': case 'fence': break;
            case 'ecall': s.done = true; s.status = 'fim'; break;
            case 'j': next = prog.labels[a[0]]; break;
            case 'jal': set(a[0], (s.pc + 1) * 4); next = prog.labels[a[1]]; break;
            case 'beqz': if (x[a[0]] === 0) next = prog.labels[a[1]]; break;
            case 'bnez': if (x[a[0]] !== 0) next = prog.labels[a[1]]; break;
            case 'beq': if (x[a[0]] === x[a[1]]) next = prog.labels[a[2]]; break;
            case 'bne': if (x[a[0]] !== x[a[1]]) next = prog.labels[a[2]]; break;
            case 'blt': if (x[a[0]] < x[a[1]]) next = prog.labels[a[2]]; break;
            case 'bge': if (x[a[0]] >= x[a[1]]) next = prog.labels[a[2]]; break;
            case 'bltu': if ((x[a[0]] >>> 0) < (x[a[1]] >>> 0)) next = prog.labels[a[2]]; break;
            case 'bgeu': if ((x[a[0]] >>> 0) >= (x[a[1]] >>> 0)) next = prog.labels[a[2]]; break;
            case 'lw': {
                const addr = addrOf(a[1]);
                if (!aligned(addr)) break;
                set(a[0], load(addr));
                ops.push({ ...mops, kind: 'R', addr });
                break;
            }
            case 'sw': {
                const addr = addrOf(a[1]);
                if (!aligned(addr)) break;
                store(c, addr, x[a[0]]);
                ops.push({ ...mops, kind: 'W', addr });
                break;
            }
            case 'lr.w': {
                const addr = addrOf(a[1]);
                if (!aligned(addr)) break;
                set(a[0], load(addr));
                res[c] = addr;
                ops.push({ ...mops, kind: 'R', addr, atomic: 'lr' });
                break;
            }
            case 'sc.w': {
                const addr = addrOf(a[2]);
                if (!aligned(addr)) break;
                const ok = res[c] === addr;
                res[c] = null;
                if (ok) {
                    store(c, addr, x[a[1]]);
                    set(a[0], 0);
                    ops.push({ ...mops, kind: 'W', addr, atomic: 'sc' });
                } else {
                    set(a[0], 1);
                    s.scFails++;
                    ops.push({ ...mops, kind: 'N', addr, atomic: 'scfail' });
                }
                break;
            }
            default: { // AMOs: lê o valor antigo para rd e grava a combinação, numa única operação
                const addr = addrOf(a[2]);
                if (!aligned(addr)) break;
                const old = load(addr), v = x[a[1]];
                const f = { 'amoswap.w': () => v, 'amoadd.w': () => old + v, 'amoand.w': () => old & v, 'amoor.w': () => old | v,
                    'amoxor.w': () => old ^ v, 'amomax.w': () => Math.max(old, v), 'amomin.w': () => Math.min(old, v) }[ins.op];
                store(c, addr, f());
                set(a[0], old);
                ops.push({ ...mops, kind: 'W', addr, atomic: 'amo' });
            }
        }
        if (s.done) continue;
        s.pc = next;
        if (s.pc >= prog.code.length) { s.done = true; s.status = 'fim'; }
        else if (s.instrs >= maxInstr) { s.done = true; s.status = 'limite'; }
    }
    return { ops, cores: st.map(({ id, status, instrs, scFails, error, x }) => ({ id, status, instrs, scFails, error, regs: [...x] })), memory: mem };
}
