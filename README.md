# Simulador de Multiprocessamento RISC-V

Simulador didático de coerência de cache por snooping em barramento, com os protocolos **MSI**, **MESI** e **MOESI**, desenvolvido para o curso de **Ciência da Computação** da **Universidade Federal do Tocantins**. Faz parte da família de simuladores do grupo, ao lado do [riscv-cpu-simulator](https://github.com/CSER-UFT/riscv-cpu-simulator), do [riscv-dlp-simulator](https://github.com/CSER-UFT/riscv-dlp-simulator) e do [riscv-fp-simulator](https://github.com/CSER-UFT/riscv-fp-simulator).

Roda inteiramente no navegador (HTML e JavaScript, sem dependências) e pode ser publicado no GitHub Pages (em Settings > Pages, fonte "GitHub Actions").

## O que faz (primeira versão)

* De 2 a 4 núcleos, cada um com cache privada de mapeamento direto e write-back; tamanho do bloco e número de linhas configuráveis.
* Entrada como sequência de acessos, uma linha por acesso: `P0 R 0x00`, `P1 W 0x04`.
* Para cada acesso: acerto ou falha, transação no barramento (BusRd, BusRdX, BusUpgr), origem dos dados (memória ou outra cache), write-back na substituição e o estado do bloco em todas as caches, com as mudanças destacadas.
* Estatísticas (transações, leituras e escritas na memória, transferências entre caches, invalidações) e a comparação dos três protocolos na mesma sequência.
* Exemplos: sequência clássica, estado exclusivo, compartilhamento falso, produtor e consumidor, substituição com write-back.
* Tabela de passos em LaTeX (cabeçalho com fundo `tabAzul` e texto branco, `\hline`, sem booktabs), pronta para provas.

Simplificações: barramento atômico (uma transação por vez, sem corridas); no MSI e no MESI os dados vêm da memória, salvo quando outra cache tem o bloco em M (ela envia e atualiza a memória); no MOESI o dono (M ou O) envia o bloco sem escrever na memória.

## Próximas etapas previstas

* Programas RISC-V por núcleo, com a extensão A (`lr`/`sc`, AMOs) e locks.
* Diagrama de estados do protocolo animado e exportação da figura em SVG.
* Calculadora de topologias de rede (enlaces, diâmetro, largura de banda da bisseção).
* Interface em inglês e ajuda completa.

## Testes

```
npm test
```

Verificam as sequências clássicas de cada protocolo, o estado exclusivo, o dono do MOESI, o compartilhamento falso, o write-back e, em sequências aleatórias, a invariante de coerência (no máximo uma cache em M, E ou O, e M ou E sem outras cópias).
