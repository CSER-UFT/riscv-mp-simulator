/** Interface: configuração, execução, passo a passo com as figuras, tabelas e exportações. */
import { PROTOCOLS, parseTrace, simulate, latexTable } from './coherence.js';
import { assemble, runPrograms } from './riscv.js';
import { TRACE_EXAMPLES, PROGRAM_EXAMPLES } from './examples.js';
import { systemSvg } from './ui/system-svg.js';
import { stateSvg } from './ui/state-svg.js';
import { standaloneSvg } from './ui/svg-export.js';

const $ = (id) => document.getElementById(id);
const hx = (n) => `0x${(n >>> 0).toString(16)}`;
const st = (s) => `<span class="st ${s}">${s}</span>`;
const sources = { trace: TRACE_EXAMPLES[Object.keys(TRACE_EXAMPLES)[0]], prog: PROGRAM_EXAMPLES[Object.keys(PROGRAM_EXAMPLES)[0]] };
let mode = 'trace', last = null, cur = 0, timer = null;

function setMode(m) {
    sources[mode] = $('src').value;
    mode = m;
    $('modeTrace').classList.toggle('sel', m === 'trace');
    $('modeProg').classList.toggle('sel', m === 'prog');
    $('progOpts').classList.toggle('hidden', m !== 'prog');
    $('progResult').classList.toggle('hidden', m !== 'prog');
    $('srcLabel').textContent = m === 'trace' ? 'Acessos (um por linha: núcleo, R ou W, endereço)' : 'Programa (o mesmo em todos os núcleos; a0 = número do núcleo)';
    const ex = m === 'trace' ? TRACE_EXAMPLES : PROGRAM_EXAMPLES;
    $('example').innerHTML = Object.keys(ex).map((k) => `<option>${k}</option>`).join('');
    $('src').value = sources[m];
    run();
}

const cfg = () => ({ protocol: $('protocol').value, cores: +$('cores').value, blockSize: +$('block').value, lines: +$('lines').value });

function run() {
    stop();
    const c = cfg();
    let ops, errors = [], prog = null, exec = null;
    if (mode === 'trace') {
        const r = parseTrace($('src').value, c.cores);
        ops = r.ops;
        if (r.errors.length) errors.push(`Linhas não entendidas: ${r.errors.map((e) => e.line).join(', ')} (use, por exemplo, "P1 W 0x10"; núcleos de 0 a ${c.cores - 1}).`);
    } else {
        prog = assemble($('src').value);
        errors = prog.errors.map((e) => `Linha ${e.line}: ${e.msg}`);
        if (!prog.errors.length) {
            exec = runPrograms(prog, { cores: c.cores, blockSize: c.blockSize, schedule: $('schedule').value, seed: +$('seed').value, maxInstr: +$('maxInstr').value || 400 });
            for (const k of exec.cores) if (k.error) errors.push(`P${k.id}: ${k.error}`);
            ops = exec.ops;
        } else ops = [];
    }
    $('errors').textContent = errors.join('\n');
    const r = simulate(ops, c);
    last = { r, c, prog, exec };
    renderTable();
    renderStats();
    renderProgram();
    $('slider').max = r.steps.length;
    show(r.steps.length ? 1 : 0);
}

function describe(s) {
    if (s.hit === null) return 'sc.w falhou';
    return s.hit ? 'acerto' : 'falha';
}

function renderTable() {
    const { r, c } = last;
    const withInstr = mode === 'prog';
    const head = `<tr><th>#</th>${withInstr ? '<th>Instrução</th>' : ''}<th>Acesso</th><th>Bloco</th><th>Resultado</th><th>Barramento</th><th>Dados de</th>${Array.from({ length: c.cores }, (_, k) => `<th>P${k}</th>`).join('')}<th>Obs.</th></tr>`;
    $('steps').innerHTML = head + r.steps.map((s, i) => {
        const obs = [s.wb !== null ? `write-back do bloco ${s.wb}` : '', s.notes.includes('flush') ? 'dono atualiza a memória' : '', s.notes.includes('silent') ? 'E→M sem barramento' : '',
            s.atomic === 'scfail' ? 'reserva perdida: nada é gravado' : '', s.atomic === 'amo' ? 'AMO: lê e grava de uma vez' : '', s.atomic === 'lr' ? 'reserva o endereço' : ''].filter(Boolean).join('; ');
        const acc = s.hit === null ? '-' : `P${s.core} ${s.kind === 'R' ? 'lê' : 'escreve'} ${hx(s.addr)}`;
        return `<tr data-i="${i + 1}"><td>${i + 1}</td>${withInstr ? `<td class="mono" style="text-align:left">P${s.core}: ${s.text}</td>` : ''}<td class="mono">${acc}</td><td>${s.block}</td><td>${describe(s)}</td><td class="mono">${s.bus ?? '-'}</td><td>${s.from === 'mem' ? 'memória' : s.from ?? '-'}</td>${s.after.map((a, k) => `<td class="${a !== s.before[k] ? 'chg' : ''}" title="antes: ${s.before[k]}">${st(a)}</td>`).join('')}<td class="note">${obs}</td></tr>`;
    }).join('');
}

function renderStats() {
    const { r, c } = last;
    const t = r.stats;
    $('summary').textContent = `${c.protocol.toUpperCase()}, ${c.cores} núcleos, blocos de ${c.blockSize} bytes`;
    $('stats').innerHTML = [['Acertos', t.hits], ['Falhas (inclui upgrade)', t.misses], ['BusRd', t.bus.BusRd], ['BusRdX', t.bus.BusRdX], ['BusUpgr', t.bus.BusUpgr], ['Transações no barramento', t.busTotal], ['Leituras da memória', t.memReads], ['Escritas na memória', t.memWrites], ['Transferências entre caches', t.c2c], ['Invalidações', t.invalidations]].map(([k, v]) => `<tr><th style="text-align:left">${k}</th><td>${v}</td></tr>`).join('');
    const ops = r.steps;
    const all = PROTOCOLS.map((p) => [p, simulate(ops, { ...c, protocol: p }).stats]);
    $('compare').innerHTML = `<tr><th></th>${all.map(([p]) => `<th>${p.toUpperCase()}</th>`).join('')}</tr>` + [['Barramento', 'busTotal'], ['Leituras da memória', 'memReads'], ['Escritas na memória', 'memWrites'], ['Entre caches', 'c2c'], ['Invalidações', 'invalidations']].map(([k, f]) => `<tr><th style="text-align:left">${k}</th>${all.map(([, s]) => `<td>${s[f]}</td>`).join('')}</tr>`).join('');
}

function renderProgram() {
    const { exec, prog } = last;
    if (mode !== 'prog') return;
    if (!exec) { $('coresTable').innerHTML = ''; $('memTable').innerHTML = ''; return; }
    const sit = { fim: 'terminou', limite: 'parou no limite de instruções', erro: 'erro' };
    $('coresTable').innerHTML = '<tr><th>Núcleo</th><th>Instruções</th><th>Acessos</th><th>sc.w que falharam</th><th>Situação</th></tr>'
        + exec.cores.map((k) => `<tr><td>P${k.id}</td><td>${k.instrs}</td><td>${exec.ops.filter((o) => o.core === k.id && o.kind !== 'N').length}</td><td>${k.scFails}</td><td>${sit[k.status]}</td></tr>`).join('');
    const names = Object.entries(prog.dataLabels).sort((a, b) => a[1] - b[1]);
    const used = new Set(names.map(([, a]) => a));
    const extra = [...exec.memory.keys()].filter((a) => !used.has(a)).sort((a, b) => a - b);
    $('memTable').innerHTML = '<tr><th>Rótulo</th><th>Endereço</th><th>Bloco</th><th>Valor</th></tr>'
        + [...names.map(([n, a]) => [n, a]), ...extra.map((a) => ['', a])].map(([n, a]) => `<tr><td class="mono">${n}</td><td class="mono">${hx(a)}</td><td>${Math.floor(a / last.c.blockSize)}</td><td>${exec.memory.get(a) ?? 0}</td></tr>`).join('');
}

function show(i) {
    const { r, c } = last;
    cur = Math.max(0, Math.min(i, r.steps.length));
    const step = cur ? r.steps[cur - 1] : null;
    const sel = $('figSel').value;
    $('figSys').classList.toggle('hidden', sel === 'fsm');
    $('figFsm').classList.toggle('hidden', sel === 'sys');
    if (sel !== 'fsm') $('figSys').innerHTML = systemSvg(step, c, cur);
    if (sel !== 'sys') $('figFsm').innerHTML = stateSvg(c.protocol, step, c.cores);
    $('slider').value = cur;
    $('pos').textContent = `passo ${cur} de ${r.steps.length}`;
    for (const tr of $('steps').querySelectorAll('tr.cur')) tr.classList.remove('cur');
    const row = $('steps').querySelector(`tr[data-i="${cur}"]`);
    if (row) {
        row.classList.add('cur');
        const box = $('stepsBox'), top = row.offsetTop - box.offsetTop;
        if (top < box.scrollTop + 30 || top > box.scrollTop + box.clientHeight - 30) box.scrollTop = top - box.clientHeight / 2;
    }
}

function stop() { if (timer) { clearInterval(timer); timer = null; $('play').textContent = '▶ Animar'; } }
function play() {
    if (timer) { stop(); return; }
    if (cur >= last.r.steps.length) show(0);
    $('play').textContent = '⏸ Pausar';
    timer = setInterval(() => { if (cur >= last.r.steps.length) stop(); else show(cur + 1); }, 1000);
}

function download(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

$('modeTrace').onclick = () => mode !== 'trace' && setMode('trace');
$('modeProg').onclick = () => mode !== 'prog' && setMode('prog');
$('example').onchange = () => {
    const ex = mode === 'trace' ? TRACE_EXAMPLES : PROGRAM_EXAMPLES;
    $('src').value = ex[$('example').value];
    if ($('example').value.startsWith('Substituição')) $('lines').value = '1';
    run();
};
$('run').onclick = run;
for (const id of ['protocol', 'cores', 'block', 'lines', 'schedule', 'seed', 'maxInstr']) $(id).onchange = run;
$('first').onclick = () => { stop(); show(0); };
$('prev').onclick = () => { stop(); show(cur - 1); };
$('next').onclick = () => { stop(); show(cur + 1); };
$('last').onclick = () => { stop(); show(last.r.steps.length); };
$('play').onclick = play;
$('slider').oninput = () => { stop(); show(+$('slider').value); };
$('figSel').onchange = () => show(cur);
$('steps').onclick = (e) => { const tr = e.target.closest('tr[data-i]'); if (tr) { stop(); show(+tr.dataset.i); } };
document.addEventListener('keydown', (e) => {
    if (e.target.closest('textarea, input, select')) return;
    if (e.key === 'ArrowRight') { stop(); show(cur + 1); } else if (e.key === 'ArrowLeft') { stop(); show(cur - 1); }
});
for (const b of document.querySelectorAll('[data-export]')) {
    b.onclick = () => {
        const kind = b.dataset.export;
        // A figura escondida também pode ser exportada: desenha no painel antes de copiar o estilo.
        const holder = kind === 'sistema' ? $('figSys') : $('figFsm');
        const step = cur ? last.r.steps[cur - 1] : null;
        const wasHidden = holder.classList.contains('hidden');
        holder.classList.remove('hidden');
        holder.innerHTML = kind === 'sistema' ? systemSvg(step, last.c, cur) : stateSvg(last.c.protocol, step, last.c.cores);
        download(`coerencia-${kind}-${last.c.protocol}-passo-${cur}.svg`, standaloneSvg(holder.querySelector('svg')), 'image/svg+xml');
        if (wasHidden) holder.classList.add('hidden');
    };
}
$('tex').onclick = () => { if (last) download('coerencia.tex', latexTable(last.r.steps, last.c), 'application/x-tex'); };
$('theme').onclick = () => { document.documentElement.dataset.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; };

$('example').innerHTML = Object.keys(TRACE_EXAMPLES).map((k) => `<option>${k}</option>`).join('');
$('src').value = sources.trace;
run();
