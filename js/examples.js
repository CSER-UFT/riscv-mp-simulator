/**
 * Exemplos prontos, em português e inglês: sequências de acessos e programas RISC-V com a extensão A.
 * Nos programas só os comentários mudam de idioma; o código é o mesmo.
 */
import { getLanguage } from './i18n/index.js';

/** Texto no idioma atual. */
export const pick = (o) => o[getLanguage()] ?? o.pt;

export const TRACE_EXAMPLES = [
    {
        id: 'basic',
        name: { pt: 'Leituras e escrita em um bloco', en: 'Reads and a write to one block' },
        src: { pt: '# três núcleos leem e escrevem o mesmo bloco\n', en: '# three cores read and write the same block\n' },
        body: 'P0 R 0x00\nP1 R 0x00\nP0 W 0x00\nP1 R 0x00\nP2 W 0x00\nP1 R 0x00',
    },
    {
        id: 'exclusive',
        name: { pt: 'Exclusivo: leitura e escrita sem compartilhar', en: 'Exclusive: read and write without sharing' },
        src: { pt: '# no MESI, a escrita depois da leitura não usa o barramento\n', en: '# in MESI, the write after the read does not use the bus\n' },
        body: 'P0 R 0x40\nP0 W 0x40\nP0 R 0x40\nP1 R 0x40',
    },
    {
        id: 'false-sharing',
        name: { pt: 'Compartilhamento falso', en: 'False sharing' },
        src: { pt: '# P0 escreve em 0x00 e P1 em 0x04: variáveis diferentes, mesmo bloco de 16 bytes\n', en: '# P0 writes 0x00 and P1 writes 0x04: different variables, same 16 byte block\n' },
        body: 'P0 W 0x00\nP1 W 0x04\nP0 W 0x00\nP1 W 0x04\nP0 W 0x00\nP1 W 0x04',
    },
    {
        id: 'producer',
        name: { pt: 'Produtor e consumidor', en: 'Producer and consumer' },
        src: { pt: '# P0 produz o dado (0x100) e sinaliza a flag (0x200); P1 lê a flag e depois o dado\n', en: '# P0 produces the data (0x100) and sets the flag (0x200); P1 reads the flag and then the data\n' },
        body: 'P0 W 0x100\nP0 W 0x200\nP1 R 0x200\nP1 R 0x100\nP0 W 0x100\nP1 R 0x100',
    },
    {
        id: 'writeback',
        lines: 1,
        name: { pt: 'Substituição com write-back', en: 'Replacement with write-back' },
        src: { pt: '# com 1 linha por cache, 0x00 e 0x40 disputam a mesma linha\n', en: '# with 1 line per cache, 0x00 and 0x40 compete for the same line\n' },
        body: 'P0 W 0x00\nP0 R 0x40\nP1 R 0x00',
    },
];

const DATA = {
    pt: `.data
lock:   .word 0
        .align 5            # contador em outro bloco (blocos de até 32 B)
count:  .word 0
.text
        la   s0, lock
        la   s1, count
        li   s2, 2          # incrementos por núcleo
`,
    en: `.data
lock:   .word 0
        .align 5            # counter in another block (blocks up to 32 B)
count:  .word 0
.text
        la   s0, lock
        la   s1, count
        li   s2, 2          # increments per core
`,
};

const CS = {
    pt: ['# seção crítica', '# trabalho dentro da seção crítica', '# libera a trava'],
    en: ['# critical section', '# work inside the critical section', '# releases the lock'],
};
const critical = (l) => `        lw   t2, 0(s1)       ${CS[l][0]}
        addi t2, t2, 1
        li   t3, 4           ${CS[l][1]}
work:   addi t3, t3, -1
        bnez t3, work
        sw   t2, 0(s1)
        sw   zero, 0(s0)     ${CS[l][2]}
        addi s2, s2, -1
        bnez s2, loop
        ecall
`;

const both = (f) => ({ pt: f('pt'), en: f('en') });

export const PROGRAM_EXAMPLES = [
    {
        id: 'race',
        name: { pt: 'Condição de corrida (sem trava)', en: 'Race condition (no lock)' },
        src: both((l) => `${{
            pt: `# Cada núcleo soma 1 ao contador duas vezes, sem trava.
# Com a intercalação em rodízio, os núcleos leem o mesmo valor e uma soma se perde:
# a coerência garante que todos vejam a última escrita, não que a sequência lw/addi/sw seja atômica.`,
            en: `# Each core adds 1 to the counter twice, without a lock.
# With round robin interleaving, the cores read the same value and an increment is lost:
# coherence guarantees that everyone sees the last write, not that the lw/addi/sw sequence is atomic.`,
        }[l]}
${DATA[l]}loop:
        lw   t0, 0(s1)
        addi t0, t0, 1
        sw   t0, 0(s1)
        addi s2, s2, -1
        bnez s2, loop
        ecall
`),
    },
    {
        id: 'tas',
        name: { pt: 'Trava com amoswap (test and set)', en: 'Lock with amoswap (test and set)' },
        src: both((l) => `${{
            pt: `# Spinlock: amoswap grava 1 e devolve o valor antigo; se era 0, a trava foi obtida.
# Cada tentativa é uma escrita: o bloco da trava passa de cache em cache (BusRdX) enquanto alguém espera.`,
            en: `# Spinlock: amoswap writes 1 and returns the old value; if it was 0, the lock was acquired.
# Every attempt is a write: the lock block moves from cache to cache (BusRdX) while someone waits.`,
        }[l]}
${DATA[l]}loop:
        li   t0, 1
acq:    amoswap.w.aq t1, t0, (s0)
        bnez t1, acq
${critical(l)}`),
    },
    {
        id: 'ttas',
        name: { pt: 'Trava test and test and set', en: 'Test and test and set lock' },
        src: both((l) => `${{
            pt: `# Primeiro lê a trava (lw) até ela parecer livre; só então tenta o amoswap.
# Enquanto espera, cada núcleo lê a cópia S da própria cache, sem usar o barramento.`,
            en: `# First reads the lock (lw) until it looks free; only then tries the amoswap.
# While waiting, each core reads the S copy in its own cache, without using the bus.`,
        }[l]}
${DATA[l]}loop:
        li   t0, 1
spin:   lw   t1, 0(s0)
        bnez t1, spin
        amoswap.w.aq t1, t0, (s0)
        bnez t1, spin
${critical(l)}`),
    },
    {
        id: 'lrsc',
        name: { pt: 'Incremento com lr.w e sc.w', en: 'Increment with lr.w and sc.w' },
        src: both((l) => `${{
            pt: `# lr.w lê e reserva o endereço; sc.w só grava se a reserva continuar valendo.
# Se outro núcleo escrever no bloco antes (invalidando a cópia), sc.w falha (t1 = 1) e o laço repete.`,
            en: `# lr.w reads and reserves the address; sc.w only writes if the reservation still holds.
# If another core writes the block first (invalidating the copy), sc.w fails (t1 = 1) and the loop repeats.`,
        }[l]}
${DATA[l]}loop:
retry:  lr.w t0, (s1)
        addi t0, t0, 1
        sc.w t1, t0, (s1)
        bnez t1, retry
        addi s2, s2, -1
        bnez s2, loop
        ecall
`),
    },
    {
        id: 'amoadd',
        name: { pt: 'Incremento com amoadd', en: 'Increment with amoadd' },
        src: both((l) => `${{
            pt: '# amoadd soma na memória numa única operação atômica: sem trava e sem repetição.',
            en: '# amoadd adds in memory in a single atomic operation: no lock and no retries.',
        }[l]}
${DATA[l]}loop:
        li   t0, 1
        amoadd.w zero, t0, (s1)
        addi s2, s2, -1
        bnez s2, loop
        ecall
`),
    },
    {
        id: 'false-sharing',
        name: { pt: 'Compartilhamento falso com dados por núcleo', en: 'False sharing with per core data' },
        src: both((l) => `${{
            pt: `# Cada núcleo escreve só na própria posição de um vetor; mesmo sem dados em comum,
# as posições estão no mesmo bloco e as cópias se invalidam. Troque o deslocamento (slli) por 6
# para afastar as posições 64 bytes e o tráfego some.`,
            en: `# Each core writes only its own position of an array; even without shared data,
# the positions are in the same block and the copies invalidate each other. Change the shift (slli)
# to 6 to place the positions 64 bytes apart and the traffic disappears.`,
        }[l]}
.data
vet:    .space 64
.text
        la   s0, vet
        slli t0, a0, 2       # a0 = ${l === 'pt' ? 'número do núcleo; posição' : 'core number; position'} a0*4
        add  s0, s0, t0
        li   s2, 3
loop:   lw   t1, 0(s0)
        addi t1, t1, 1
        sw   t1, 0(s0)
        addi s2, s2, -1
        bnez s2, loop
        ecall
`),
    },
];

/** Código do exemplo no idioma atual. */
export function exampleSource(ex) {
    return ex.body !== undefined ? pick(ex.src) + ex.body : pick(ex.src);
}
