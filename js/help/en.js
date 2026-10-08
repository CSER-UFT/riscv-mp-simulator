/** Simulator help, in English. Each section becomes an entry in the table of contents. */
export default {
    title: 'RISC-V Multiprocessing Simulator',
    lead: 'Educational simulator of cache coherence in shared memory multiprocessors: bus snooping with the MSI, MESI and MOESI protocols, and RISC-V programs with the A extension (atomic instructions). Developed for the <strong>Computer Science</strong> program at the <strong>Federal University of Tocantins</strong> (UFT).',
    searchPlaceholder: 'Search the help',
    noResults: 'No section contains this term.',
    tocTitle: 'Contents',
    close: 'Close help',
    sections: [
        {
            id: 'start',
            title: 'Getting started',
            html: `
<p>The simulator applies a sequence of memory accesses made by several cores and shows, step by step, what happens in the private caches, on the bus and in memory. Everything runs in the browser: nothing is sent to a server.</p>
<ol>
    <li>Choose the <strong>protocol</strong>, the number of <strong>cores</strong>, the <strong>block size</strong> and the number of <strong>lines</strong> in each cache.</li>
    <li>Choose the mode: <strong>Access trace</strong>, where you write directly who reads or writes which address, or <strong>RISC-V program</strong>, where the cores run a program and the accesses come from its instructions.</li>
    <li>Pick an <strong>example</strong> or write your own text in the editor. Errors appear below it, with the line number; click an error to jump to it.</li>
    <li>Click <strong>Run</strong> (or <kbd>Ctrl</kbd> + <kbd>Enter</kbd>): the editor text is applied and the animation starts from the beginning. Changing any option also runs again, without animating.</li>
    <li>Move forward with the <kbd>right arrow</kbd> or with <strong>Animate</strong>. The figures and the step table follow the current step.</li>
</ol>
<p class="tip">Suggestion to begin: the example <em>Reads and a write to one block</em> with MSI, then the same with MESI and MOESI, watching the <strong>Protocol comparison</strong> table.</p>`,
        },
        {
            id: 'screen',
            title: 'The screen',
            html: `
<dl>
    <dt>Header</dt>
    <dd>On the right: language, the contrast button (light or dark theme) and this help. Language and theme are stored in the browser.</dd>
    <dt>Configuration</dt>
    <dd>Protocol, cores (2 to 4), block (4 to 64 bytes), lines per cache (1 to 16), mode, example and the editor. In program mode you also get the core interleaving, the seed and the instruction limit per core.</dd>
    <dt>Program result</dt>
    <dd>Program mode only: instructions executed, memory accesses and failed <code>sc.w</code> on each core, and the final values in memory (labels of the <code>.data</code> section and other written addresses).</dd>
    <dt>Step by step</dt>
    <dd>Navigation controls, the figure selector, SVG export and the <a href="#h-figures">system and state diagram</a> figures.</dd>
    <dt>Steps</dt>
    <dd>One row per access: hit or miss, bus transaction, data source and the block state in each cache <em>after</em> the access. Changed cells are highlighted; hover to see the previous state. Click a row to go to that step.</dd>
    <dt>Statistics and comparison</dt>
    <dd>Totals for the sequence and the same sequence applied to the three protocols, side by side.</dd>
</dl>`,
        },
        {
            id: 'controls',
            title: 'Navigation and shortcuts',
            html: `
<table>
    <tr><th>Action</th><th>Keyboard</th><th>Button</th></tr>
    <tr><td>Next step</td><td><kbd>→</kbd></td><td>right arrow</td></tr>
    <tr><td>Previous step</td><td><kbd>←</kbd></td><td>left arrow</td></tr>
    <tr><td>Go to the start (before the first access)</td><td><kbd>Home</kbd></td><td>first button</td></tr>
    <tr><td>Go to the end</td><td><kbd>End</kbd></td><td>last button</td></tr>
    <tr><td>Animate or pause</td><td><kbd>Space</kbd></td><td>Animate</td></tr>
    <tr><td>Run</td><td><kbd>Ctrl</kbd> + <kbd>Enter</kbd> (in the editor)</td><td>Run</td></tr>
    <tr><td>Insert indentation in the editor</td><td><kbd>Tab</kbd></td><td></td></tr>
    <tr><td>Close the help</td><td><kbd>Esc</kbd></td><td>Close help</td></tr>
</table>
<p>Navigation shortcuts do not apply while the cursor is in the editor or in a field.</p>`,
        },
        {
            id: 'protocols',
            title: 'Coherence and the protocols',
            html: `
<p>Each core has a private direct mapped <strong>write-back</strong> cache. All caches sit on the same bus and watch (<em>snoop</em>) the transactions of the other cores. The protocol is <strong>write invalidate</strong>: before writing, a core obtains the block exclusively and invalidates the other copies.</p>
<table>
    <tr><th>State</th><th>Meaning</th><th>Protocols</th></tr>
    <tr><td><strong>M</strong> modified</td><td>only valid copy, different from memory</td><td>MSI, MESI, MOESI</td></tr>
    <tr><td><strong>O</strong> owned</td><td>modified copy that also exists in other caches (in S); the owner answers for the block and writes it to memory when it leaves</td><td>MOESI</td></tr>
    <tr><td><strong>E</strong> exclusive</td><td>only copy, equal to memory; may become M without using the bus</td><td>MESI, MOESI</td></tr>
    <tr><td><strong>S</strong> shared</td><td>read only copy, possibly in several caches</td><td>all</td></tr>
    <tr><td><strong>I</strong> invalid</td><td>the line does not hold the block (or holds an invalidated copy)</td><td>all</td></tr>
</table>
<p>Bus transactions:</p>
<dl>
    <dt>BusRd</dt><dd>read miss: asks for a copy to read.</dd>
    <dt>BusRdX</dt><dd>write miss: asks for the block exclusively, and the other copies are invalidated.</dd>
    <dt>BusUpgr</dt><dd>write to a block the cache already holds in S (or O): only invalidates the other copies, with no data transfer.</dd>
    <dt>Flush</dt><dd>a cache holding the block in M (or O) puts the data on the bus. In MSI and MESI it also updates memory and goes to S; in MOESI it becomes (or stays) the owner, in O, and memory is not updated.</dd>
</dl>
<p>MESI saves bus traffic in the common pattern of reading and then writing private data (E goes to M silently). MOESI saves memory writes when a modified block is read by other cores.</p>`,
        },
        {
            id: 'figures',
            title: 'The figures',
            html: `
<p>Both figures follow the style of the Patterson and Hennessy textbook and show the current step.</p>
<h3>System</h3>
<p>Cores at the top, caches with all lines (line number, stored block and state), the bus with an <strong>address and command</strong> line and a <strong>data</strong> line, and memory at the bottom. The line of the accessed block is highlighted in every cache.</p>
<ul>
    <li><strong>Blue</strong>: the accessing core and the transaction it puts on the bus.</li>
    <li><strong>Orange</strong>: caches that hold a valid copy and react to the transaction (they snoop the bus).</li>
    <li><strong>Green</strong>: the data path, from memory or from the owning cache to the requester.</li>
    <li><strong>Red</strong>: memory writes (flush or write-back) and invalidated caches (dashed border).</li>
</ul>
<h3>State diagram</h3>
<p>One circle per protocol state. <strong>Solid</strong> arrows are actions of the processor itself (<code>PrRd</code>, <code>PrWr</code>, followed by the transaction they cause), and <strong>dashed</strong> arrows are reactions to what the cache observes on the bus. In the current step, the transition of the accessing core lights up in blue and those of the other caches in orange. Inside each state you see the cores that hold the block in it.</p>
<p>Use <strong>Export system (SVG)</strong> and <strong>Export diagram (SVG)</strong> to take the figure of the current step to slides and exams. The file always uses the light theme and opens in the browser, Inkscape, LibreOffice and PowerPoint.</p>`,
        },
        {
            id: 'trace',
            title: 'Access trace',
            html: `
<p>One line per access, in the format <code>core operation address</code>:</p>
<pre><code>P0 R 0x00     # P0 reads address 0x00
P1 W 0x04     # P1 writes address 0x04
2 w 16        # the P is optional; decimal works too</code></pre>
<p>The operation can be <code>R</code> (or <code>L</code>, <code>LW</code>, <code>READ</code>) for reads and <code>W</code> (or <code>S</code>, <code>SW</code>, <code>WRITE</code>) for writes. Text after <code>#</code> is a comment. The block is the address divided by the block size, and the cache line is the block modulo the number of lines.</p>`,
        },
        {
            id: 'program',
            title: 'RISC-V programs',
            html: `
<p>In program mode, all cores run the same RV32I program with the A extension, on a shared memory. At the start, <code>a0</code> holds the core number (the same value as <code>csrr rd, mhartid</code>), which is how each core can pick its part of the work. A core finishes at <code>ecall</code> or when it runs past the last instruction.</p>
<p>Cores are interleaved one instruction at a time: <strong>round robin</strong> (P0, P1, P2, P0...) or <strong>random</strong> order, reproducible through the seed. Change the seed to see other interleavings of the same program.</p>
<h3>Instructions</h3>
<table>
    <tr><th>Group</th><th>Instructions</th></tr>
    <tr><td>Arithmetic and logic</td><td><code>add sub mul and or xor sll srl sra slt sltu addi andi ori xori slli srli srai slti</code></td></tr>
    <tr><td>Memory</td><td><code>lw sw</code></td></tr>
    <tr><td>Branches and jumps</td><td><code>beq bne blt bge bltu bgeu jal j beqz bnez</code></td></tr>
    <tr><td>Atomics (A extension)</td><td><code>lr.w sc.w amoswap.w amoadd.w amoand.w amoor.w amoxor.w amomax.w amomin.w</code>, with optional <code>.aq</code> and <code>.rl</code> suffixes</td></tr>
    <tr><td>Others</td><td><code>li la mv nop fence ecall csrr</code></td></tr>
</table>
<p>The <code>.data</code> section starts at address 0 and accepts labels, <code>.word</code>, <code>.space</code> and <code>.align</code> (power of 2, as in GNU as). Instructions do not take space in data memory.</p>
<p>Since the simulator is RV32, instructions that only exist in RV64 (<code>ld</code>, <code>sd</code>, <code>lwu</code>, <code>addw</code> and the others with the <code>w</code> suffix) are rejected with an explanation: they work on 64 bit registers. In every RISC-V variant instructions are 32 bits long, so the PC always advances by 4.</p>
<h3>Generated accesses</h3>
<ul>
    <li><code>lw</code> and <code>lr.w</code> read.</li>
    <li><code>sw</code> and <code>sc.w</code> (when it succeeds) write.</li>
    <li>AMOs read and write the block in a single operation, so they request the block exclusively (BusRdX or BusUpgr) even when they only read the old value.</li>
    <li>A failed <code>sc.w</code> does not access memory; it shows up in the table as <em>sc.w failed</em>.</li>
</ul>
<h3>The lr.w reservation</h3>
<p><code>lr.w</code> reads and reserves the address. The reservation is lost when another core writes to the same block (invalidating the copy kills the reservation) or when the core itself executes <code>sc.w</code>. If the reservation still holds, <code>sc.w</code> writes and puts 0 in the destination register; otherwise it does not write and puts 1.</p>`,
        },
        {
            id: 'examples',
            title: 'Examples and what to observe',
            html: `
<dl>
    <dt>Reads and a write to one block</dt><dd>The classic textbook sequence. Compare the three columns of the comparison: MOESI avoids the memory writes.</dd>
    <dt>Exclusive</dt><dd>In MESI, the write after the read does not use the bus (E to M).</dd>
    <dt>False sharing</dt><dd>Different variables in the same block cause invalidations. Reduce the block to 4 bytes and they disappear.</dd>
    <dt>Producer and consumer</dt><dd>Data and flag move from one cache to the other.</dd>
    <dt>Replacement with write-back</dt><dd>With one line per cache, a modified block that leaves is written to memory.</dd>
    <dt>Race condition</dt><dd>Without a lock, the final counter is smaller than expected (2 increments per core): coherence guarantees that everyone sees the last write, but it does not make <code>lw</code>, <code>addi</code> and <code>sw</code> an indivisible operation.</dd>
    <dt>Lock with amoswap and test and test and set</dt><dd>Both locks give the right result. With 3 or 4 cores, compare the bus transactions: while waiting, test and set writes on every attempt and the lock block moves from cache to cache; test and test and set reads its own S copy and only tries the <code>amoswap</code> when the lock looks free.</dd>
    <dt>Increment with lr.w and sc.w</dt><dd>Watch the <code>sc.w</code> that fail when another core writes the block between <code>lr.w</code> and <code>sc.w</code>, and the loop repeating.</dd>
    <dt>Increment with amoadd</dt><dd>A single atomic instruction per increment: the smallest number of accesses.</dd>
    <dt>False sharing with per core data</dt><dd>Each core writes only its own position, but the positions share the block. Change the shift to 6 and the traffic disappears.</dd>
</dl>`,
        },
        {
            id: 'classroom',
            title: 'Classroom resources',
            html: `
<ul>
    <li><strong>LaTeX table</strong>: the step table ready for exams and exercise lists, with a <code>tabAzul</code> header and white text, <code>\\hline</code> and no booktabs. Requires <code>\\usepackage[table]{xcolor}</code>.</li>
    <li><strong>Export system (SVG)</strong> and <strong>Export diagram (SVG)</strong>: the figures of the current step, for slides.</li>
    <li>To build exercises, prepare a short sequence, erase the state of some cells in the LaTeX table and ask students to fill them in; the <em>Bus</em> column and the data source also make good questions.</li>
</ul>`,
        },
        {
            id: 'model',
            title: 'Model simplifications',
            html: `
<ul>
    <li>The bus is atomic: it serves one transaction at a time, with no races between requests and no transient states.</li>
    <li>There is no timing: the simulator counts accesses and transactions, not cycles.</li>
    <li>Caches are direct mapped, write-back and write allocate.</li>
    <li>In MSI and MESI the data comes from memory, unless another cache holds the block in M; in MOESI the owner (M or O) always supplies the block.</li>
    <li>Instruction fetch is outside the model; only data memory goes through the caches.</li>
    <li>Memory order is sequentially consistent (one instruction at a time), so the <code>.aq</code> and <code>.rl</code> suffixes and <code>fence</code> change nothing.</li>
</ul>`,
        },
        {
            id: 'refs',
            title: 'References',
            html: `
<ul>
    <li>D. A. Patterson and J. L. Hennessy. <em>Computer Organization and Design: The Hardware/Software Interface</em>, RISC-V edition. Chapter 5 (cache coherence) and chapter 6 (multiprocessors).</li>
    <li>J. L. Hennessy and D. A. Patterson. <em>Computer Architecture: A Quantitative Approach</em>, 6th edition. Chapter 5 (thread level parallelism).</li>
    <li>The RISC-V Instruction Set Manual, Volume I: the A extension chapter.</li>
</ul>
<p>Other simulators in the family: <a href="https://github.com/CSER-UFT/riscv-cpu-simulator">riscv-cpu-simulator</a>, <a href="https://github.com/CSER-UFT/riscv-dlp-simulator">riscv-dlp-simulator</a> and <a href="https://github.com/CSER-UFT/riscv-fp-simulator">riscv-fp-simulator</a>.</p>`,
        },
    ],
};
