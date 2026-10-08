/**
 * Destaque de sintaxe do editor (mesmas classes dos outros simuladores): assembly RISC-V no modo programa
 * e a sequência de acessos (núcleo, R ou W, endereço) no modo sequência.
 */
import { isMnemonic, isRegister } from '../riscv.js';

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

function asmLine(code) {
    let out = '', first = true, m;
    const re = /([A-Za-z_.$][\w.$]*:?)|([+-]?(?:0x[0-9a-fA-F]+|\d+))|(\s+)|(.)/g;
    while ((m = re.exec(code)) !== null) {
        const [tok, word, num, space] = m;
        if (space) out += tok;
        else if (num) out += `<span class="hl-num">${esc(tok)}</span>`;
        else if (word) {
            if (word.endsWith(':')) out += `<span class="hl-label">${esc(tok)}</span>`;
            else if (first && word.startsWith('.')) { out += `<span class="hl-dir">${esc(tok)}</span>`; first = false; }
            else if (first && isMnemonic(word)) { out += `<span class="hl-op">${esc(tok)}</span>`; first = false; }
            else if (first) { out += `<span class="hl-bad">${esc(tok)}</span>`; first = false; }
            else if (isRegister(word) || /^mhartid$/i.test(word)) out += `<span class="hl-reg">${esc(tok)}</span>`;
            else out += esc(tok);
        } else out += esc(tok);
    }
    return out;
}

function traceLine(code) {
    let out = '', m;
    const re = /(p?\d+(?=\s*[,:\s]))|\b(r|w|l|s|ld|st|lw|sw|read|write)\b|(0x[0-9a-fA-F]+|\d+)|(\s+)|(.)/gi;
    let field = 0;
    while ((m = re.exec(code)) !== null) {
        const [tok, core, kind, num, space] = m;
        if (space) { out += tok; continue; }
        if (core && field === 0) out += `<span class="hl-reg">${esc(tok)}</span>`;
        else if (kind && field === 1) out += `<span class="hl-op">${esc(tok)}</span>`;
        else if (num) out += `<span class="hl-num">${esc(tok)}</span>`;
        else out += esc(tok);
        if (tok !== ',' && tok !== ':') field++;
    }
    return out;
}

/**
 * Converte o código em HTML destacado.
 * @param {string} source
 * @param {Set<number>} errorLines linhas (a partir de 1) com erro
 * @param {'trace'|'prog'} mode
 */
export function highlight(source, errorLines = new Set(), mode = 'prog') {
    return source.split('\n').map((line, i) => {
        const c = line.indexOf('#');
        const code = c >= 0 ? line.slice(0, c) : line;
        const comment = c >= 0 ? `<span class="hl-com">${esc(line.slice(c))}</span>` : '';
        const html = (mode === 'trace' ? traceLine(code) : asmLine(code)) + comment;
        return errorLines.has(i + 1) ? `<span class="hl-err">${html || ' '}</span>` : html;
    }).join('\n') + '\n';
}
