/** Interface: configuração, editor, execução, passo a passo com as figuras, tabelas, idioma, tema e ajuda. */
import { PROTOCOLS, parseTrace, simulate, latexTable } from './coherence.js';
import { assemble, runPrograms } from './riscv.js';
import { TRACE_EXAMPLES, PROGRAM_EXAMPLES, exampleSource, pick } from './examples.js';
import { systemSvg } from './ui/system-svg.js';
import { stateSvg } from './ui/state-svg.js';
import { standaloneSvg } from './ui/svg-export.js';
import { highlight } from './ui/highlight.js';
import { Help } from './ui/help.js';
import { LANGUAGES, getLanguage, setLanguage, t } from './i18n/index.js';

const $ = (id) => document.getElementById(id);
const hx = (n) => `0x${(n >>> 0).toString(16)}`;
const st = (s) => `<span class="st ${s}">${s}</span>`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

let mode = 'trace', last = null, cur = 0, timer = null, errorLines = new Set();
// Texto de cada modo e o exemplo carregado (null quando o texto foi editado).
const state = { trace: { ex: TRACE_EXAMPLES[0].id, src: null }, prog: { ex: PROGRAM_EXAMPLES[0].id, src: null } };
const examples = () => (mode === 'trace' ? TRACE_EXAMPLES : PROGRAM_EXAMPLES);

// Editor com destaque de sintaxe -----------------------------------------------------------------------------

const code = $('src');
function refreshEditor() {
    const n = code.value.split('\n').length;
    let g = '';
    for (let i = 1; i <= n; i++) g += errorLines.has(i) ? `<span class="err">${i}</span>\n` : `${i}\n`;
    // O conteúdo vai num bloco interno, deslocado por transform (ver syncScroll).
    $('gutter').innerHTML = `<div class="code-inner">${g}</div>`;
    $('highlight').innerHTML = `<div class="code-inner">${highlight(code.value, errorLines, mode)}</div>`;
    syncScroll();
}
// Destaque e numeração acompanham a rolagem por transform: o textarea tem barras de rolagem e o <pre> não,
// então a rolagem máxima do <pre> é menor e, no fim de linhas longas, o cursor ficava deslocado.
function syncScroll() {
    const x = code.scrollLeft, y = code.scrollTop;
    const g = $('gutter').firstElementChild, h = $('highlight').firstElementChild;
    if (g) g.style.transform = `translateY(${-y}px)`;
    if (h) h.style.transform = `translate(${-x}px, ${-y}px)`;
}
code.addEventListener('scroll', syncScroll);
code.addEventListener('input', () => {
    state[mode].ex = null;
    $('example').value = '';
    errorLines = new Set();
    refreshEditor();
});
code.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
        e.preventDefault();
        const { selectionStart: a, selectionEnd: b, value } = code;
        code.value = value.slice(0, a) + '    ' + value.slice(b);
        code.selectionStart = code.selectionEnd = a + 4;
        refreshEditor();
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        run();
    }
});
function goToLine(n) {
    const lines = code.value.split('\n');
    const start = lines.slice(0, n - 1).reduce((s, l) => s + l.length + 1, 0);
    code.focus();
    code.setSelectionRange(start, start + (lines[n - 1]?.length ?? 0));
    code.scrollTop = Math.max(0, (n - 4) * 20);
    syncScroll();
}
$('errors').addEventListener('click', (e) => { const li = e.target.closest('li[data-line]'); if (li) goToLine(+li.dataset.line); });

function fillExamples() {
    const s = state[mode];
    $('example').innerHTML = `<option value="">${t('cfg.own')}</option>` + examples().map((e) => `<option value="${e.id}">${esc(pick(e.name))}</option>`).join('');
    $('example').value = s.ex ?? '';
}

function loadExample(id) {
    const ex = examples().find((e) => e.id === id);
    if (!ex) return;
    state[mode].ex = id;
    code.value = exampleSource(ex);
    if (ex.lines) $('lines').value = String(ex.lines);
}

function setMode(m) {
    state[mode].src = code.value;
    mode = m;
    $('modeTrace').classList.toggle('sel', m === 'trace');
    $('modeProg').classList.toggle('sel', m === 'prog');
    $('progOpts').classList.toggle('hidden', m !== 'prog');
    $('progResult').classList.toggle('hidden', m !== 'prog');
    $('srcLabel').textContent = t(m === 'trace' ? 'src.trace' : 'src.prog');
    fillExamples();
    if (state[m].ex) loadExample(state[m].ex); else code.value = state[m].src ?? '';
    run();
}

// Execução ---------------------------------------------------------------------------------------------------

const cfg = () => ({ protocol: $('protocol').value, cores: +$('cores').value, blockSize: +$('block').value, lines: +$('lines').value });

function run() {
    stop();
    const c = cfg();
    let ops = [], prog = null, exec = null;
    const errors = [];
    if (mode === 'trace') {
        const r = parseTrace(code.value, c.cores);
        ops = r.ops;
        if (r.errors.length) errors.push({ line: r.errors[0].line, msg: t('err.trace', { lines: r.errors.map((e) => e.line).join(', '), max: c.cores - 1 }), all: r.errors.map((e) => e.line) });
    } else {
        prog = assemble(code.value);
        for (const e of prog.errors) errors.push({ line: e.line, msg: t('err.line', { n: e.line, msg: e.msg }) });
        if (!prog.errors.length) {
            exec = runPrograms(prog, { cores: c.cores, blockSize: c.blockSize, schedule: $('schedule').value, seed: +$('seed').value, maxInstr: +$('maxInstr').value || 400 });
            for (const k of exec.cores) if (k.error) errors.push({ line: k.error.line, msg: t('err.core', { c: k.id, n: k.error.line, msg: k.error.msg }) });
            ops = exec.ops;
        }
    }
    errorLines = new Set(errors.flatMap((e) => e.all ?? [e.line]));
    $('errors').innerHTML = errors.map((e) => `<li data-line="${e.line}">${esc(e.msg)}</li>`).join('');
    refreshEditor();
    const r = simulate(ops, c);
    last = { r, c, prog, exec };
    $('slider').max = r.steps.length;
    renderAll(r.steps.length ? 1 : 0);
}

function renderAll(step = cur) {
    renderTable();
    renderStats();
    renderProgram();
    show(step);
}

function renderTable() {
    const { r, c } = last;
    const withInstr = mode === 'prog';
    const head = `<tr><th>#</th>${withInstr ? `<th>${t('th.instr')}</th>` : ''}<th>${t('th.access')}</th><th>${t('th.block')}</th><th>${t('th.result')}</th><th>${t('th.bus')}</th><th>${t('th.from')}</th>${Array.from({ length: c.cores }, (_, k) => `<th>P${k}</th>`).join('')}<th>${t('th.obs')}</th></tr>`;
    $('steps').innerHTML = head + r.steps.map((s, i) => {
        const obs = [s.wb !== null ? t('obs.wb', { b: s.wb }) : '', s.notes.includes('flush') ? t('obs.flush') : '', s.notes.includes('silent') ? t('obs.silent') : '',
            s.atomic === 'scfail' ? t('obs.scfail') : '', s.atomic === 'amo' ? t('obs.amo') : '', s.atomic === 'lr' ? t('obs.lr') : ''].filter(Boolean).join('; ');
        const acc = s.hit === null ? '-' : `P${s.core} ${t(s.kind === 'R' ? 'acc.read' : 'acc.write')} ${hx(s.addr)}`;
        const res = s.hit === null ? t('res.scfail') : t(s.hit ? 'res.hit' : 'res.miss');
        return `<tr data-i="${i + 1}"><td>${i + 1}</td>${withInstr ? `<td class="mono" style="text-align:left">P${s.core}: ${esc(s.text)}</td>` : ''}<td class="mono">${acc}</td><td>${s.block}</td><td>${res}</td><td class="mono">${s.bus ?? '-'}</td><td>${s.from === 'mem' ? t('from.mem') : s.from ?? '-'}</td>${s.after.map((a, k) => `<td class="${a !== s.before[k] ? 'chg' : ''}" title="${s.before[k]} → ${a}">${st(a)}</td>`).join('')}<td class="note">${obs}</td></tr>`;
    }).join('');
}

function renderStats() {
    const { r, c } = last;
    const s = r.stats;
    $('summary').textContent = t('summary', { p: c.protocol.toUpperCase(), n: c.cores, b: c.blockSize });
    $('stats').innerHTML = [[t('stats.hits'), s.hits], [t('stats.misses'), s.misses], ['BusRd', s.bus.BusRd], ['BusRdX', s.bus.BusRdX], ['BusUpgr', s.bus.BusUpgr], [t('stats.busTotal'), s.busTotal], [t('stats.memReads'), s.memReads], [t('stats.memWrites'), s.memWrites], [t('stats.c2c'), s.c2c], [t('stats.invalidations'), s.invalidations]]
        .map(([k, v]) => `<tr><th style="text-align:left">${k}</th><td>${v}</td></tr>`).join('');
    const all = PROTOCOLS.map((p) => [p, simulate(r.steps, { ...c, protocol: p }).stats]);
    $('compare').innerHTML = `<tr><th></th>${all.map(([p]) => `<th>${p.toUpperCase()}</th>`).join('')}</tr>`
        + [[t('cmp.bus'), 'busTotal'], [t('stats.memReads'), 'memReads'], [t('stats.memWrites'), 'memWrites'], [t('cmp.c2c'), 'c2c'], [t('stats.invalidations'), 'invalidations']]
            .map(([k, f]) => `<tr><th style="text-align:left">${k}</th>${all.map(([, x]) => `<td>${x[f]}</td>`).join('')}</tr>`).join('');
}

function renderProgram() {
    const { exec, prog } = last;
    if (mode !== 'prog') return;
    if (!exec) { $('coresTable').innerHTML = ''; $('memTable').innerHTML = ''; return; }
    $('coresTable').innerHTML = `<tr><th>${t('th.core')}</th><th>${t('th.instrs')}</th><th>${t('th.accesses')}</th><th>${t('th.scfails')}</th><th>${t('th.status')}</th></tr>`
        + exec.cores.map((k) => `<tr><td>P${k.id}</td><td>${k.instrs}</td><td>${exec.ops.filter((o) => o.core === k.id && o.kind !== 'N').length}</td><td>${k.scFails}</td><td>${t(`status.${k.status}`)}</td></tr>`).join('');
    const names = Object.entries(prog.dataLabels).sort((a, b) => a[1] - b[1]);
    const used = new Set(names.map(([, a]) => a));
    const extra = [...exec.memory.keys()].filter((a) => !used.has(a)).sort((a, b) => a - b);
    $('memTable').innerHTML = `<tr><th>${t('th.label')}</th><th>${t('th.addr')}</th><th>${t('th.block')}</th><th>${t('th.value')}</th></tr>`
        + [...names, ...extra.map((a) => ['', a])].map(([n, a]) => `<tr><td class="mono">${esc(n)}</td><td class="mono">${hx(a)}</td><td>${Math.floor(a / last.c.blockSize)}</td><td>${exec.memory.get(a) ?? 0}</td></tr>`).join('');
}

// Passo a passo ----------------------------------------------------------------------------------------------

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
    $('pos').textContent = t('step.pos', { i: cur, n: r.steps.length });
    for (const tr of $('steps').querySelectorAll('tr.cur')) tr.classList.remove('cur');
    const row = $('steps').querySelector(`tr[data-i="${cur}"]`);
    if (row) {
        row.classList.add('cur');
        const box = $('stepsBox'), top = row.offsetTop;
        if (top < box.scrollTop + 30 || top > box.scrollTop + box.clientHeight - 30) box.scrollTop = top - box.clientHeight / 2;
    }
}

function playLabel() { $('play').textContent = timer ? `⏸ ${t('ctl.pause')}` : `▶ ${t('ctl.play')}`; }
function stop() { if (timer) { clearInterval(timer); timer = null; } playLabel(); }
function play() {
    if (timer) { stop(); return; }
    if (cur >= last.r.steps.length) show(0);
    timer = setInterval(() => { if (cur >= last.r.steps.length) stop(); else show(cur + 1); }, 1000);
    playLabel();
}

function download(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// Tema, idioma e ajuda ---------------------------------------------------------------------------------------

const themeButton = $('theme-toggle');
function updateThemeIcon() {
    const dark = document.documentElement.dataset.theme === 'dark';
    themeButton.querySelector('.icon').className = `icon ${dark ? 'i-sun' : 'i-moon'}`;
    themeButton.setAttribute('aria-pressed', String(dark));
}
themeButton.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('mp.theme', next); } catch { /* só nesta visita */ }
    updateThemeIcon();
});
updateThemeIcon();

const help = new Help($('readme'));
$('open-ajuda').addEventListener('click', () => (help.isOverlay() ? help.close() : help.open()));
document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-help]');
    if (a) { e.preventDefault(); help.open(a.dataset.help); }
});

const langSelect = $('lang-select');
langSelect.innerHTML = Object.entries(LANGUAGES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
langSelect.value = getLanguage();
function applyDomTranslations() {
    document.documentElement.lang = getLanguage() === 'en' ? 'en' : 'pt-BR';
    document.title = t('ui.docTitle');
    for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
    for (const el of document.querySelectorAll('[data-i18n-html]')) el.innerHTML = t(el.dataset.i18nHtml);
    for (const el of document.querySelectorAll('[data-i18n-title]')) el.title = t(el.dataset.i18nTitle);
    $('srcLabel').textContent = t(mode === 'trace' ? 'src.trace' : 'src.prog');
    playLabel();
    help.render();
}
langSelect.addEventListener('change', () => {
    setLanguage(langSelect.value);
    applyDomTranslations();
    // Os exemplos carregados trocam de idioma junto (só os comentários mudam); texto editado fica como está.
    fillExamples();
    if (state[mode].ex) { loadExample(state[mode].ex); run(); } else if (last) renderAll();
});

// Eventos ----------------------------------------------------------------------------------------------------

$('modeTrace').onclick = () => mode !== 'trace' && setMode('trace');
$('modeProg').onclick = () => mode !== 'prog' && setMode('prog');
$('example').onchange = () => { if ($('example').value) { loadExample($('example').value); run(); } };
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
    if (help.isOverlay() || e.target.closest('textarea, input, select, button')) return;
    const keys = { ArrowRight: () => show(cur + 1), ArrowLeft: () => show(cur - 1), Home: () => show(0), End: () => show(last.r.steps.length) };
    if (keys[e.key]) { e.preventDefault(); stop(); keys[e.key](); } else if (e.key === ' ') { e.preventDefault(); play(); }
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
        const name = { pt: { sistema: 'sistema', estados: 'estados' }, en: { sistema: 'system', estados: 'states' } }[getLanguage()][kind];
        download(`${getLanguage() === 'en' ? 'coherence' : 'coerencia'}-${name}-${last.c.protocol}-${cur}.svg`, standaloneSvg(holder.querySelector('svg')), 'image/svg+xml');
        if (wasHidden) holder.classList.add('hidden');
    };
}
$('tex').onclick = () => { if (last) download(getLanguage() === 'en' ? 'coherence.tex' : 'coerencia.tex', latexTable(last.r.steps, last.c), 'application/x-tex'); };

applyDomTranslations();
fillExamples();
loadExample(state.trace.ex);
run();
