import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assemble, runPrograms } from '../js/riscv.js';
import { simulate } from '../js/coherence.js';
import { PROGRAM_EXAMPLES, exampleSource } from '../js/examples.js';
import { stateSvg, stepTransitions } from '../js/ui/state-svg.js';
import { systemSvg } from '../js/ui/system-svg.js';

const exec = (name, cores = 3, schedule = 'rr', seed = 1, blockSize = 16) => {
    const p = assemble(exampleSource(PROGRAM_EXAMPLES.find((e) => e.id === name)));
    assert.deepEqual(p.errors, []);
    return { p, r: runPrograms(p, { cores, blockSize, schedule, seed }) };
};
const count = ({ p, r }) => r.memory.get(p.dataLabels.count);

test('montador: rótulos de dados, alinhamento e erros', () => {
    const p = assemble('.data\na: .word 5, 6\n.align 4\nb: .space 8\n.text\nla t0, b\nlw t1, 4(t0)\nfoo t0\nld t0, 0(t1)\nj nada');
    assert.equal(p.dataLabels.a, 0);
    assert.equal(p.dataLabels.b, 16);
    assert.equal(p.data.get(4), 6);
    const msgs = p.errors.map((e) => e.msg).join(' | ');
    assert.match(msgs, /não suportada: foo/);
    assert.match(msgs, /ld existe só no RV64.*lw\/sw/);
    assert.match(msgs, /rótulo desconhecido "nada"/);
});

test('corrida sem trava perde incrementos; travas e atômicas não', () => {
    for (const n of [2, 3, 4]) {
        assert.equal(count(exec('race', n)), 2);
        for (const k of ['tas', 'ttas', 'lrsc', 'amoadd'])
            for (const seed of [1, 7, 42]) assert.equal(count(exec(k, n, 'random', seed)), 2 * n, `${k}, ${n} núcleos, semente ${seed}`);
    }
});

test('sc.w falha quando outro núcleo escreve no bloco reservado', () => {
    const e = exec('lrsc', 3);
    assert.ok(e.r.cores.some((c) => c.scFails > 0));
    assert.ok(e.r.ops.some((o) => o.kind === 'N' && o.atomic === 'scfail'));
    const s = simulate(e.r.ops, { protocol: 'mesi', cores: 3, blockSize: 16, lines: 4 });
    for (const st of s.steps.filter((x) => x.kind === 'N')) assert.deepEqual(st.before, st.after);
});

test('test and test and set usa menos o barramento que test and set com 4 núcleos', () => {
    const bus = (k) => simulate(exec(k, 4).r.ops, { protocol: 'mesi', cores: 4, blockSize: 16, lines: 4 }).stats.busTotal;
    assert.ok(bus('ttas') < bus('tas'));
});

test('a0 traz o número do núcleo; limite de instruções', () => {
    const r = runPrograms(assemble('loop: j loop'), { cores: 2, blockSize: 16, maxInstr: 10 });
    assert.deepEqual(r.cores.map((c) => [c.regs[10], c.status, c.instrs]), [[0, 'limite', 10], [1, 'limite', 10]]);
});

test('figuras: transições destacadas e SVG bem formado', () => {
    const ops = [{ core: 0, kind: 'R', addr: 0 }, { core: 1, kind: 'R', addr: 0 }, { core: 0, kind: 'W', addr: 0 }];
    const cfg = { protocol: 'mesi', cores: 3, blockSize: 16, lines: 4 };
    const { steps } = simulate(ops, cfg);
    assert.deepEqual(stepTransitions(steps[1]), { cpu: { from: 'I', to: 'S', shared: true }, bus: [{ core: 0, from: 'E', to: 'S' }] });
    assert.deepEqual(stepTransitions(steps[2]).bus, [{ core: 1, from: 'S', to: 'I' }]);
    for (const p of ['msi', 'mesi', 'moesi']) {
        const svg = stateSvg(p, steps[2], 3);
        assert.match(svg, /class="edge snoop snp"/);
        assert.match(svg, /class="edge  on"/);
        assert.equal((svg.match(/<svg/g) || []).length, 1);
    }
    const sys = systemSvg(steps[2], cfg, 3);
    assert.match(sys, /BusUpgr/);
    assert.match(sys, /invalidada/);
    assert.match(systemSvg(null, cfg, 0), /estado inicial/);
});

test('exemplos montam nos dois idiomas', async () => {
    const { setLanguage } = await import('../js/i18n/index.js');
    for (const lang of ['en', 'pt']) {
        setLanguage(lang);
        for (const ex of PROGRAM_EXAMPLES) assert.deepEqual(assemble(exampleSource(ex)).errors, [], `${lang} ${ex.id}`);
    }
});
