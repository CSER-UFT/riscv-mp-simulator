/**
 * Ajuda do simulador, em português. Cada seção vira um item do índice.
 * O texto evita hífens e travessões por padrão de estilo do projeto (exceto em nomes como RISC-V e write-back).
 */
export default {
    title: 'Simulador de Multiprocessamento RISC-V',
    lead: 'Simulador didático de coerência de cache em multiprocessadores com memória compartilhada: snooping em barramento com os protocolos MSI, MESI e MOESI, e programas RISC-V com a extensão A (instruções atômicas). Desenvolvido para o curso de <strong>Ciência da Computação</strong> da <strong>Universidade Federal do Tocantins</strong>.',
    searchPlaceholder: 'Buscar na ajuda',
    noResults: 'Nenhuma seção contém esse termo.',
    tocTitle: 'Conteúdo',
    close: 'Fechar ajuda',
    sections: [
        {
            id: 'start',
            title: 'Primeiros passos',
            html: `
<p>O simulador aplica uma sequência de acessos à memória feitos por vários núcleos e mostra, passo a passo, o que acontece nas caches privadas, no barramento e na memória. Tudo roda no navegador: nada é enviado a um servidor.</p>
<ol>
    <li>Escolha o <strong>protocolo</strong>, o número de <strong>núcleos</strong>, o <strong>tamanho do bloco</strong> e o número de <strong>linhas</strong> de cada cache.</li>
    <li>Escolha o modo: <strong>Sequência de acessos</strong>, em que você escreve diretamente quem lê ou escreve qual endereço, ou <strong>Programa RISC-V</strong>, em que os núcleos executam um programa e os acessos saem das instruções.</li>
    <li>Escolha um <strong>exemplo</strong> ou escreva o seu texto no editor. Os erros aparecem abaixo dele, com o número da linha; clique em um erro para ir até ela.</li>
    <li>Clique em <strong>Executar</strong> (ou <kbd>Ctrl</kbd> + <kbd>Enter</kbd>): o texto do editor é aplicado e a animação começa do início. A mudança de qualquer opção também executa de novo, mas sem animar.</li>
    <li>Avance com a <kbd>seta para a direita</kbd> ou com <strong>Animar</strong>. As figuras e a tabela de passos acompanham o passo atual.</li>
</ol>
<p class="tip">Sugestão para começar: o exemplo <em>Leituras e escrita em um bloco</em> com o MSI, depois o mesmo com o MESI e o MOESI, observando a tabela <strong>Comparação dos protocolos</strong>.</p>`,
        },
        {
            id: 'screen',
            title: 'A tela',
            html: `
<dl>
    <dt>Cabeçalho</dt>
    <dd>À direita ficam o idioma, o botão de contraste (tema claro ou escuro) e esta ajuda. O idioma e o tema ficam guardados no navegador.</dd>
    <dt>Configuração</dt>
    <dd>Protocolo, núcleos (2 a 4), bloco (4 a 64 bytes), linhas por cache (1 a 16), modo, exemplo e o editor. No modo programa aparecem a intercalação dos núcleos, a semente e o limite de instruções por núcleo.</dd>
    <dt>Resultado do programa</dt>
    <dd>Só no modo programa: instruções executadas, acessos à memória e <code>sc.w</code> que falharam em cada núcleo, e os valores finais na memória (rótulos da seção <code>.data</code> e demais endereços escritos).</dd>
    <dt>Passo a passo</dt>
    <dd>Controles de navegação, a escolha das figuras, a exportação em SVG e as figuras do <a href="#h-figures">sistema e do diagrama de estados</a>.</dd>
    <dt>Passos</dt>
    <dd>Uma linha por acesso: acerto ou falha, transação no barramento, origem dos dados e o estado do bloco em cada cache <em>depois</em> do acesso. As células que mudaram ficam destacadas; passe o mouse para ver o estado anterior. Clique em uma linha para ir até o passo.</dd>
    <dt>Estatísticas e comparação</dt>
    <dd>Totais da sequência e a mesma sequência aplicada aos três protocolos, lado a lado.</dd>
</dl>`,
        },
        {
            id: 'controls',
            title: 'Navegação e atalhos',
            html: `
<table>
    <tr><th>Ação</th><th>Teclado</th><th>Botão</th></tr>
    <tr><td>Avançar um passo</td><td><kbd>→</kbd></td><td>seta para a direita</td></tr>
    <tr><td>Voltar um passo</td><td><kbd>←</kbd></td><td>seta para a esquerda</td></tr>
    <tr><td>Ir para o início (antes do primeiro acesso)</td><td><kbd>Home</kbd></td><td>primeiro botão</td></tr>
    <tr><td>Ir para o fim</td><td><kbd>End</kbd></td><td>último botão</td></tr>
    <tr><td>Animar ou pausar</td><td><kbd>Espaço</kbd></td><td>Animar</td></tr>
    <tr><td>Executar</td><td><kbd>Ctrl</kbd> + <kbd>Enter</kbd> (no editor)</td><td>Executar</td></tr>
    <tr><td>Inserir recuo no editor</td><td><kbd>Tab</kbd></td><td></td></tr>
    <tr><td>Fechar a ajuda</td><td><kbd>Esc</kbd></td><td>Fechar ajuda</td></tr>
</table>
<p>Os atalhos de navegação não valem enquanto o cursor está no editor ou em um campo.</p>`,
        },
        {
            id: 'protocols',
            title: 'Coerência e os protocolos',
            html: `
<p>Cada núcleo tem uma cache privada de mapeamento direto com <strong>write-back</strong>. Todas as caches ficam ligadas ao mesmo barramento e vigiam (<em>snooping</em>) as transações dos outros núcleos. O protocolo é de <strong>invalidação</strong>: antes de escrever, o núcleo obtém o bloco com exclusividade e invalida as outras cópias.</p>
<table>
    <tr><th>Estado</th><th>Significado</th><th>Protocolos</th></tr>
    <tr><td><strong>M</strong> modificado</td><td>única cópia válida, diferente da memória</td><td>MSI, MESI, MOESI</td></tr>
    <tr><td><strong>O</strong> dono</td><td>cópia modificada que também existe em outras caches (em S); o dono responde pelo bloco e o grava na memória quando sair</td><td>MOESI</td></tr>
    <tr><td><strong>E</strong> exclusivo</td><td>única cópia, igual à memória; pode passar a M sem usar o barramento</td><td>MESI, MOESI</td></tr>
    <tr><td><strong>S</strong> compartilhado</td><td>cópia somente para leitura, possivelmente em várias caches</td><td>todos</td></tr>
    <tr><td><strong>I</strong> inválido</td><td>a linha não guarda o bloco (ou guarda uma cópia invalidada)</td><td>todos</td></tr>
</table>
<p>Transações no barramento:</p>
<dl>
    <dt>BusRd</dt><dd>falha de leitura: pede uma cópia para ler.</dd>
    <dt>BusRdX</dt><dd>falha de escrita: pede o bloco com exclusividade, e as outras cópias são invalidadas.</dd>
    <dt>BusUpgr</dt><dd>escrita em um bloco que a cache já tem em S (ou O): só invalida as outras cópias, sem transferir dados.</dd>
    <dt>Flush</dt><dd>uma cache com o bloco em M (ou O) envia os dados no barramento. No MSI e no MESI ela também atualiza a memória e passa a S; no MOESI ela vira (ou continua) dona, em O, e a memória não é atualizada.</dd>
</dl>
<p>O MESI economiza o barramento no padrão comum de ler e depois escrever um dado privado (E passa a M em silêncio). O MOESI economiza escritas na memória quando um bloco modificado é lido por outros núcleos.</p>`,
        },
        {
            id: 'figures',
            title: 'As figuras',
            html: `
<p>As duas figuras seguem o estilo do livro de Patterson e Hennessy e mostram o passo atual.</p>
<h3>Sistema</h3>
<p>Núcleos no alto, caches com todas as linhas (número da linha, bloco guardado e estado), o barramento com uma linha de <strong>endereço e comando</strong> e outra de <strong>dados</strong>, e a memória embaixo. A linha correspondente ao bloco acessado fica destacada em todas as caches.</p>
<ul>
    <li><strong>Azul</strong>: o núcleo que acessa e a transação que ele coloca no barramento.</li>
    <li><strong>Laranja</strong>: as caches que guardam uma cópia válida e reagem à transação (observam o barramento).</li>
    <li><strong>Verde</strong>: o caminho dos dados, da memória ou da cache dona até quem pediu.</li>
    <li><strong>Vermelho</strong>: escritas na memória (flush ou write-back) e as caches invalidadas (borda tracejada).</li>
</ul>
<h3>Diagrama de estados</h3>
<p>Um círculo por estado do protocolo. As setas <strong>cheias</strong> são ações do próprio processador (<code>PrRd</code>, <code>PrWr</code>, seguidas da transação que provocam), e as <strong>tracejadas</strong> são reações ao que a cache observa no barramento. No passo atual, a transição do núcleo que acessa acende em azul e as das outras caches em laranja. Dentro de cada estado aparecem os núcleos que guardam o bloco nele.</p>
<p>Use <strong>Exportar sistema (SVG)</strong> e <strong>Exportar diagrama (SVG)</strong> para levar a figura do passo atual para slides e provas. O arquivo sai sempre com o tema claro e abre no navegador, no Inkscape, no LibreOffice e no PowerPoint.</p>`,
        },
        {
            id: 'trace',
            title: 'Sequência de acessos',
            html: `
<p>Uma linha por acesso, no formato <code>núcleo operação endereço</code>:</p>
<pre><code>P0 R 0x00     # P0 lê o endereço 0x00
P1 W 0x04     # P1 escreve no endereço 0x04
2 w 16        # o P é opcional; decimal também vale</code></pre>
<p>A operação pode ser <code>R</code> (ou <code>L</code>, <code>LW</code>, <code>READ</code>) para leitura e <code>W</code> (ou <code>S</code>, <code>SW</code>, <code>WRITE</code>) para escrita. O texto após <code>#</code> é comentário. O bloco é o endereço dividido pelo tamanho do bloco, e a linha da cache é o bloco módulo o número de linhas.</p>`,
        },
        {
            id: 'program',
            title: 'Programas RISC-V',
            html: `
<p>No modo programa, todos os núcleos executam o mesmo programa em RV32I com a extensão A, sobre uma memória compartilhada. No início, <code>a0</code> recebe o número do núcleo (o mesmo valor de <code>csrr rd, mhartid</code>), e é assim que cada núcleo pode escolher a sua parte do trabalho. Um núcleo termina em <code>ecall</code> ou ao passar da última instrução.</p>
<p>Os núcleos são intercalados uma instrução por vez: em <strong>rodízio</strong> (P0, P1, P2, P0...) ou em ordem <strong>aleatória</strong>, reproduzível pela semente. Mude a semente para ver outras intercalações do mesmo programa.</p>
<h3>Instruções</h3>
<table>
    <tr><th>Grupo</th><th>Instruções</th></tr>
    <tr><td>Aritméticas e lógicas</td><td><code>add sub mul and or xor sll srl sra slt sltu addi andi ori xori slli srli srai slti</code></td></tr>
    <tr><td>Memória</td><td><code>lw sw</code></td></tr>
    <tr><td>Desvios e saltos</td><td><code>beq bne blt bge bltu bgeu jal j beqz bnez</code></td></tr>
    <tr><td>Atômicas (extensão A)</td><td><code>lr.w sc.w amoswap.w amoadd.w amoand.w amoor.w amoxor.w amomax.w amomin.w</code>, com sufixos opcionais <code>.aq</code> e <code>.rl</code></td></tr>
    <tr><td>Outras</td><td><code>li la mv nop fence ecall csrr</code></td></tr>
</table>
<p>A seção <code>.data</code> começa no endereço 0 e aceita rótulos, <code>.word</code>, <code>.space</code> e <code>.align</code> (potência de 2, como no GNU as). As instruções não ocupam a memória de dados.</p>
<p>Como o simulador é RV32, instruções que só existem no RV64 (<code>ld</code>, <code>sd</code>, <code>lwu</code>, <code>addw</code> e as demais com sufixo <code>w</code>) são recusadas com uma explicação: elas operam com registradores de 64 bits. Em todas as versões do RISC-V as instruções têm 32 bits, por isso o PC sempre avança de 4 em 4.</p>
<h3>Acessos gerados</h3>
<ul>
    <li><code>lw</code> e <code>lr.w</code> leem.</li>
    <li><code>sw</code> e <code>sc.w</code> (quando consegue) escrevem.</li>
    <li>As AMOs leem e escrevem o bloco numa única operação; por isso pedem o bloco exclusivo (BusRdX ou BusUpgr) mesmo quando só leem o valor antigo.</li>
    <li>Um <code>sc.w</code> que falha não acessa a memória; ele aparece na tabela como <em>sc.w falhou</em>.</li>
</ul>
<h3>Reserva do lr.w</h3>
<p><code>lr.w</code> lê e reserva o endereço. A reserva se perde quando outro núcleo escreve no mesmo bloco (a invalidação da cópia derruba a reserva) ou quando o próprio núcleo executa <code>sc.w</code>. Se a reserva ainda vale, <code>sc.w</code> grava e põe 0 no registrador de destino; caso contrário não grava e põe 1.</p>`,
        },
        {
            id: 'examples',
            title: 'Exemplos e o que observar',
            html: `
<dl>
    <dt>Leituras e escrita em um bloco</dt><dd>A sequência clássica dos livros. Compare as três colunas da comparação: o MOESI evita as escritas na memória.</dd>
    <dt>Exclusivo</dt><dd>No MESI, a escrita depois da leitura não usa o barramento (E para M).</dd>
    <dt>Compartilhamento falso</dt><dd>Variáveis diferentes no mesmo bloco geram invalidações. Reduza o bloco para 4 bytes e elas somem.</dd>
    <dt>Produtor e consumidor</dt><dd>O dado e a flag passam de uma cache para a outra.</dd>
    <dt>Substituição com write-back</dt><dd>Com uma linha por cache, um bloco modificado que sai é gravado na memória.</dd>
    <dt>Condição de corrida</dt><dd>Sem trava, o contador final fica menor que o esperado (2 incrementos por núcleo): a coerência garante que todos vejam a última escrita, mas não torna <code>lw</code>, <code>addi</code> e <code>sw</code> uma operação indivisível.</dd>
    <dt>Trava com amoswap e test and test and set</dt><dd>As duas travas dão o resultado certo. Com 3 ou 4 núcleos, compare as transações no barramento: enquanto espera, o test and set escreve a cada tentativa e o bloco da trava passa de cache em cache; o test and test and set lê a própria cópia em S e só tenta o <code>amoswap</code> quando a trava parece livre.</dd>
    <dt>Incremento com lr.w e sc.w</dt><dd>Veja os <code>sc.w</code> que falham quando outro núcleo escreve no bloco entre o <code>lr.w</code> e o <code>sc.w</code>, e o laço repetindo.</dd>
    <dt>Incremento com amoadd</dt><dd>Uma única instrução atômica por incremento: o menor número de acessos.</dd>
    <dt>Compartilhamento falso com dados por núcleo</dt><dd>Cada núcleo só escreve na própria posição, mas as posições dividem o bloco. Troque o deslocamento para 6 e o tráfego some.</dd>
</dl>`,
        },
        {
            id: 'classroom',
            title: 'Recursos para aula',
            html: `
<ul>
    <li><strong>Tabela em LaTeX</strong>: a tabela de passos pronta para provas e listas, com cabeçalho em <code>tabAzul</code> e texto branco, <code>\\hline</code> e sem booktabs. Requer <code>\\usepackage[table]{xcolor}</code>.</li>
    <li><strong>Exportar sistema (SVG)</strong> e <strong>Exportar diagrama (SVG)</strong>: as figuras do passo atual, para slides.</li>
    <li>Para criar exercícios, monte uma sequência curta, apague o estado de algumas células na tabela LaTeX e peça aos alunos que completem; a coluna <em>Barramento</em> e a origem dos dados também rendem boas perguntas.</li>
</ul>`,
        },
        {
            id: 'model',
            title: 'Simplificações do modelo',
            html: `
<ul>
    <li>O barramento é atômico: atende uma transação por vez, sem corridas entre pedidos e sem estados transitórios.</li>
    <li>Não há temporização: o simulador conta acessos e transações, não ciclos.</li>
    <li>As caches são de mapeamento direto, com write-back e alocação na escrita.</li>
    <li>No MSI e no MESI os dados vêm da memória, salvo quando outra cache tem o bloco em M; no MOESI o dono (M ou O) sempre envia o bloco.</li>
    <li>A busca de instruções fica fora do modelo; só a memória de dados passa pelas caches.</li>
    <li>A ordem da memória é sequencialmente consistente (uma instrução por vez), por isso os sufixos <code>.aq</code> e <code>.rl</code> e o <code>fence</code> não mudam nada.</li>
</ul>`,
        },
        {
            id: 'refs',
            title: 'Referências',
            html: `
<ul>
    <li>D. A. Patterson e J. L. Hennessy. <em>Organização e Projeto de Computadores: a Interface Hardware/Software</em>, edição RISC-V. Capítulo 5 (coerência de cache) e capítulo 6 (multiprocessadores).</li>
    <li>J. L. Hennessy e D. A. Patterson. <em>Arquitetura de Computadores: uma Abordagem Quantitativa</em>, 6ª edição. Capítulo 5 (paralelismo em nível de thread).</li>
    <li>The RISC-V Instruction Set Manual, Volume I: capítulo da extensão A.</li>
</ul>
<p>Outros simuladores da família: <a href="https://github.com/CSER-UFT/riscv-cpu-simulator">riscv-cpu-simulator</a>, <a href="https://github.com/CSER-UFT/riscv-dlp-simulator">riscv-dlp-simulator</a> e <a href="https://github.com/CSER-UFT/riscv-fp-simulator">riscv-fp-simulator</a>.</p>`,
        },
    ],
};
