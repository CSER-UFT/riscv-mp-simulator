/** Exemplos prontos: sequências de acessos e programas RISC-V com a extensão A. */

export const TRACE_EXAMPLES = {
    'Leituras e escrita em um bloco': 'P0 R 0x00\nP1 R 0x00\nP0 W 0x00\nP1 R 0x00\nP2 W 0x00\nP1 R 0x00',
    'Exclusivo: leitura e escrita sem compartilhar': '# no MESI, a escrita depois da leitura não usa o barramento\nP0 R 0x40\nP0 W 0x40\nP0 R 0x40\nP1 R 0x40',
    'Compartilhamento falso': '# P0 escreve em 0x00 e P1 em 0x04: variáveis diferentes, mesmo bloco de 16 bytes\nP0 W 0x00\nP1 W 0x04\nP0 W 0x00\nP1 W 0x04\nP0 W 0x00\nP1 W 0x04',
    'Produtor e consumidor': '# P0 produz dado e sinaliza a flag; P1 espera a flag e lê o dado\nP0 W 0x100\nP0 W 0x200\nP1 R 0x200\nP1 R 0x100\nP0 W 0x100\nP1 R 0x100',
    'Substituição com write-back': '# com 1 linha por cache, 0x00 e 0x40 disputam a mesma linha\nP0 W 0x00\nP0 R 0x40\nP1 R 0x00',
};

const DATA = `.data
lock:   .word 0
        .align 5            # contador em outro bloco (blocos de até 32 B)
count:  .word 0
.text
        la   s0, lock
        la   s1, count
        li   s2, 2          # incrementos por núcleo
`;

export const PROGRAM_EXAMPLES = {
    'Condição de corrida (sem trava)': `# Cada núcleo soma 1 ao contador duas vezes, sem trava.
# Com a intercalação em rodízio, os núcleos leem o mesmo valor e uma soma se perde:
# a coerência garante que todos vejam a última escrita, não que a sequência lw/addi/sw seja atômica.
${DATA}loop:
        lw   t0, 0(s1)
        addi t0, t0, 1
        sw   t0, 0(s1)
        addi s2, s2, -1
        bnez s2, loop
        ecall
`,
    'Trava com amoswap (test and set)': `# Spinlock: amoswap grava 1 e devolve o valor antigo; se era 0, a trava foi obtida.
# Cada tentativa é uma escrita: o bloco da trava passa de cache em cache (BusRdX) enquanto alguém espera.
${DATA}loop:
        li   t0, 1
acq:    amoswap.w.aq t1, t0, (s0)
        bnez t1, acq
        lw   t2, 0(s1)       # seção crítica
        addi t2, t2, 1
        li   t3, 4           # trabalho dentro da seção crítica
work:   addi t3, t3, -1
        bnez t3, work
        sw   t2, 0(s1)
        sw   zero, 0(s0)     # libera a trava
        addi s2, s2, -1
        bnez s2, loop
        ecall
`,
    'Trava test and test and set': `# Primeiro lê a trava (lw) até ela parecer livre; só então tenta o amoswap.
# Enquanto espera, cada núcleo lê a cópia S da própria cache, sem usar o barramento.
${DATA}loop:
        li   t0, 1
spin:   lw   t1, 0(s0)
        bnez t1, spin
        amoswap.w.aq t1, t0, (s0)
        bnez t1, spin
        lw   t2, 0(s1)       # seção crítica
        addi t2, t2, 1
        li   t3, 4           # trabalho dentro da seção crítica
work:   addi t3, t3, -1
        bnez t3, work
        sw   t2, 0(s1)
        sw   zero, 0(s0)     # libera a trava
        addi s2, s2, -1
        bnez s2, loop
        ecall
`,
    'Incremento com lr.w e sc.w': `# lr.w lê e reserva o endereço; sc.w só grava se a reserva continuar valendo.
# Se outro núcleo escrever no bloco antes (invalidando a cópia), sc.w falha (t1 = 1) e o laço repete.
${DATA}loop:
retry:  lr.w t0, (s1)
        addi t0, t0, 1
        sc.w t1, t0, (s1)
        bnez t1, retry
        addi s2, s2, -1
        bnez s2, loop
        ecall
`,
    'Incremento com amoadd': `# amoadd soma na memória numa única operação atômica: sem trava e sem repetição.
${DATA}loop:
        li   t0, 1
        amoadd.w zero, t0, (s1)
        addi s2, s2, -1
        bnez s2, loop
        ecall
`,
    'Compartilhamento falso com dados por núcleo': `# Cada núcleo escreve só na própria posição de um vetor; mesmo sem dados em comum,
# as posições estão no mesmo bloco e as cópias se invalidam. Troque o deslocamento (slli) por 6
# para afastar as posições 64 bytes e o tráfego some.
.data
vet:    .space 64
.text
        la   s0, vet
        slli t0, a0, 2       # a0 = número do núcleo; posição a0*4
        add  s0, s0, t0
        li   s2, 3
loop:   lw   t1, 0(s0)
        addi t1, t1, 1
        sw   t1, 0(s0)
        addi s2, s2, -1
        bnez s2, loop
        ecall
`,
};
