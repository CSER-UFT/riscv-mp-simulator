# Simulador de Multiprocessamento RISC-V

Simulador didático de coerência de cache por snooping em barramento, com os protocolos **MSI**, **MESI** e **MOESI**, desenvolvido para o curso de **Ciência da Computação** da **Universidade Federal do Tocantins**. Faz parte da família de simuladores do grupo, ao lado do [riscv-cpu-simulator](https://github.com/CSER-UFT/riscv-cpu-simulator), do [riscv-dlp-simulator](https://github.com/CSER-UFT/riscv-dlp-simulator) e do [riscv-fp-simulator](https://github.com/CSER-UFT/riscv-fp-simulator).

Roda inteiramente no navegador (HTML e JavaScript, sem dependências), em português ou inglês, com tema claro ou escuro e ajuda completa, e pode ser publicado no GitHub Pages (em Settings > Pages, fonte "GitHub Actions").

## O que faz

* De 2 a 4 núcleos, cada um com cache privada de mapeamento direto e write-back; tamanho do bloco e número de linhas configuráveis.
* Editor com destaque de sintaxe, numeração de linhas e lista de erros (clique para ir até a linha), no mesmo padrão dos outros simuladores.
* Entrada como sequência de acessos, uma linha por acesso: `P0 R 0x00`, `P1 W 0x04`.
* Para cada acesso: acerto ou falha, transação no barramento (BusRd, BusRdX, BusUpgr), origem dos dados (memória ou outra cache), write-back na substituição e o estado do bloco em todas as caches, com as mudanças destacadas.
* Estatísticas (transações, leituras e escritas na memória, transferências entre caches, invalidações) e a comparação dos três protocolos na mesma sequência.
* Passo a passo animado com duas figuras em SVG no estilo do Patterson e Hennessy, exportáveis como arquivos SVG independentes (abrem no navegador, no Inkscape, no LibreOffice e no PowerPoint):
  * **sistema**: núcleos, caches com todas as linhas (bloco e estado), barramento com as linhas de endereço/comando e de dados, e memória; acendem o pedido do núcleo que acessa, as caches que observam, o caminho dos dados e as escritas na memória (flush e write-back);
  * **diagrama de estados** do protocolo: setas cheias para as ações do processador (PrRd, PrWr) e tracejadas para o que é observado no barramento; no passo atual, a transição do núcleo que acessa e as das outras caches ficam destacadas, e cada estado mostra os núcleos que guardam o bloco nele.
* **Programas RISC-V** (RV32I com a extensão A) executados por todos os núcleos sobre uma memória compartilhada: a0 começa com o número do núcleo (também disponível em `csrr rd, mhartid`); `lw`, `sw`, `lr.w`, `sc.w`, `amoswap.w`, `amoadd.w` e as demais AMOs; intercalação em rodízio ou aleatória com semente. Cada acesso vira um passo da coerência, e o resultado mostra as instruções de cada núcleo, os `sc.w` que falharam e os valores finais na memória. Instruções só do RV64 (`ld`, `sd`, `addw`...) recebem uma mensagem explicando o motivo.
* Exemplos de programas: condição de corrida sem trava, trava com `amoswap` (test and set), trava test and test and set (compare o tráfego no barramento com três ou quatro núcleos), incremento com `lr.w`/`sc.w`, incremento com `amoadd.w` e compartilhamento falso com dados por núcleo.
* Exemplos de sequências: sequência clássica, estado exclusivo, compartilhamento falso, produtor e consumidor, substituição com write-back.
* Tabela de passos em LaTeX (cabeçalho com fundo `tabAzul` e texto branco, `\hline`, sem booktabs), pronta para provas.

Simplificações: a busca de instruções fica fora do modelo (só a memória de dados passa pelas caches); a reserva do `lr.w` se perde quando outro núcleo escreve no mesmo bloco; barramento atômico (uma transação por vez, sem corridas); no MSI e no MESI os dados vêm da memória, salvo quando outra cache tem o bloco em M (ela envia e atualiza a memória); no MOESI o dono (M ou O) envia o bloco sem escrever na memória.

## Próximas etapas previstas

* Calculadora de topologias de rede (enlaces, diâmetro, largura de banda da bisseção).

## Testes

```
npm test
```

Verificam o montador e a execução dos programas (corrida, travas, `lr.w`/`sc.w`, `amoadd.w`), as transições destacadas nas figuras, as sequências clássicas de cada protocolo, o estado exclusivo, o dono do MOESI, o compartilhamento falso, o write-back e, em sequências aleatórias, a invariante de coerência (no máximo uma cache em M, E ou O, e M ou E sem outras cópias).
