import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTrace, simulate } from '../js/coherence.js';

const run = (trace, protocol, cores = 3, blockSize = 16, lines = 4) => simulate(parseTrace(trace, cores).ops, { protocol, cores, blockSize, lines });
const seq = (r) => r.steps.map((s) => `${s.bus ?? '-'}:${s.from ?? '-'}:${s.after.join('')}`);
const T = 'P0 R 0x0\nP1 R 0x0\nP0 W 0x0\nP1 R 0x4\nP2 W 0x0\nP1 R 0x0';

test('MSI: sequência clássica', () => {
    assert.deepEqual(seq(run(T, 'msi')), ['BusRd:mem:SII', 'BusRd:mem:SSI', 'BusUpgr:-:MII', 'BusRd:P0:SSI', 'BusRdX:mem:IIM', 'BusRd:P2:ISS']);
});

test('MESI: leitura sem outros dá E, e a escrita em E não usa o barramento', () => {
    const r = run('P0 R 0x40\nP0 W 0x40\nP1 R 0x40', 'mesi');
    assert.deepEqual(seq(r), ['BusRd:mem:EII', '-:-:MII', 'BusRd:P0:SSI']);
    assert.equal(r.stats.busTotal, 2);
    assert.equal(run('P0 R 0x40\nP0 W 0x40', 'msi').stats.busTotal, 2);
});

test('MOESI: o dono passa a O e envia o bloco sem escrever na memória', () => {
    const r = run(T, 'moesi');
    assert.deepEqual(seq(r).slice(3), ['BusRd:P0:OSI', 'BusRdX:P0:IIM', 'BusRd:P2:ISO']);
    assert.equal(r.stats.memWrites, 0);
    assert.equal(run(T, 'mesi').stats.memWrites, 2);
});

test('compartilhamento falso some com blocos pequenos', () => {
    const fs = 'P0 W 0x00\nP1 W 0x04\nP0 W 0x00\nP1 W 0x04';
    assert.equal(run(fs, 'mesi', 2, 16).stats.invalidations, 3);
    assert.equal(run(fs, 'mesi', 2, 4).stats.invalidations, 0);
});

test('substituição de bloco sujo faz write-back', () => {
    const r = run('P0 W 0x00\nP0 R 0x40\nP1 R 0x00', 'mesi', 2, 16, 1);
    assert.equal(r.steps[1].wb, 0);
    assert.equal(r.steps[2].from, 'mem');
    assert.equal(r.stats.memWrites, 1);
});

test('invariante: no máximo uma cache em M, E ou O, e M ou E não convivem com cópias', () => {
    let seed = 7;
    const rnd = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
    for (const p of ['msi', 'mesi', 'moesi']) {
        const lines = Array.from({ length: 400 }, () => `P${rnd(4)} ${rnd(2) ? 'W' : 'R'} ${rnd(8) * 4}`).join('\n');
        for (const s of run(lines, p, 4, 8, 2).steps) {
            const owners = s.after.filter((x) => 'MEO'.includes(x)).length;
            assert.ok(owners <= 1, `${p}: ${s.after.join('')}`);
            if (s.after.some((x) => x === 'M' || x === 'E')) assert.equal(s.after.filter((x) => x !== 'I').length, 1, `${p}: ${s.after.join('')}`);
        }
    }
});
