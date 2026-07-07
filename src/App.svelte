<script>
  import { iniToYaml } from './lib/iniParser.js';
  import Notepad from './lib/Notepad.svelte';
  import Icon from './lib/Icon.svelte';

  let iniText = $state(`; Configurazione di esempio — modifica o trascina un file .ini
[server]
host = localhost
port = 8080
debug = true

[database]
driver = mysql
host = db.example.com
port = 3306
name = myapp
user = admin
password = s3cret!@#

[logging]
level = info
file = /var/log/app.log
max_size = 10MB

[features.authentication]
enabled = true
session_timeout = 3600
oauth_provider = google`);

  let yamlText = $state('');
  let notepadOpen = $state(false);
  let dragActive = $state(false);
  let iniError = $state(null);
  let leftPanelWidth = $state(50);
  let isResizing = $state(false);
  let fileName = $state('');
  let copyFeedback = $state(false);
  let downloadFeedback = $state(false);

  let iniEditorEl = $state(null);
  let yamlEditorEl = $state(null);

  // Debounced conversion
  let debounceTimer = null;

  function convert() {
    try {
      const result = iniToYaml(iniText);
      if (!result || !result.trim()) {
        yamlText = '';
        iniError = null;
      } else {
        yamlText = result;
        iniError = null;
      }
    } catch (e) {
      iniError = e.message;
      yamlText = '';
    }
  }

  function scheduleConvert() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      convert();
      debounceTimer = null;
    }, 300);
  }

  // Initial conversion
  $effect(() => {
    convert();
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  });

  function onIniInput(e) {
    iniText = e.target.value;
    scheduleConvert();
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    dragActive = true;
  }

  function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    // Only set false if leaving the drop zone itself
    if (e.currentTarget === e.target) {
      dragActive = false;
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    dragActive = false;

    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const name = file.name.toLowerCase();
    if (!name.endsWith('.ini') && !name.endsWith('.cfg') && !name.endsWith('.conf') && !name.endsWith('.txt')) {
      iniError = 'Formato file non supportato. Usa .ini, .cfg, .conf o .txt';
      return;
    }

    fileName = file.name;
    iniError = null;

    const reader = new FileReader();
    reader.onload = (ev) => {
      iniText = ev.target.result;
      convert();
    };
    reader.onerror = () => {
      iniError = 'Errore nella lettura del file.';
    };
    reader.readAsText(file);
  }

  function handleFileInput(e) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    fileName = file.name;
    iniError = null;

    const reader = new FileReader();
    reader.onload = (ev) => {
      iniText = ev.target.result;
      convert();
    };
    reader.onerror = () => {
      iniError = 'Errore nella lettura del file.';
    };
    reader.readAsText(file);
  }

  async function copyYAML() {
    try {
      await navigator.clipboard.writeText(yamlText);
      copyFeedback = true;
      setTimeout(() => { copyFeedback = false; }, 2000);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = yamlText;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      copyFeedback = true;
      setTimeout(() => { copyFeedback = false; }, 2000);
    }
  }

  function downloadYAML() {
    const blob = new Blob([yamlText], { type: 'text/yaml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const base = fileName ? fileName.replace(/\.[^.]+$/, '') : 'config';
    a.href = url;
    a.download = `${base}.yaml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    downloadFeedback = true;
    setTimeout(() => { downloadFeedback = false; }, 2000);
  }

  function clearAll() {
    iniText = '';
    yamlText = '';
    fileName = '';
    iniError = null;
    if (debounceTimer) clearTimeout(debounceTimer);
  }

  function loadSample() {
    iniText = `; Configurazione di esempio — modifica o trascina un file .ini
[server]
host = localhost
port = 8080
debug = true

[database]
driver = mysql
host = db.example.com
port = 3306
name = myapp
user = admin
password = s3cret!@#

[logging]
level = info
file = /var/log/app.log
max_size = 10MB

[features.authentication]
enabled = true
session_timeout = 3600
oauth_provider = google`;
    fileName = '';
    convert();
  }

  // Resize logic
  function startResize(e) {
    e.preventDefault();
    isResizing = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  $effect(() => {
    if (!isResizing) return;

    function onMove(e) {
      if (!isResizing) return;
      const container = document.querySelector('.panels');
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      leftPanelWidth = Math.max(25, Math.min(75, pct));
    }

    function onUp() {
      isResizing = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  });

  function toggleNotepad() {
    notepadOpen = !notepadOpen;
  }

  // Syntax highlighting for INI
  function highlightINI(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // Comments
      .replace(/^(\s*)([;#].*)$/gm, '$1<span class="hl-comment">$2</span>')
      // Sections
      .replace(/^(\s*\[)([^\]]+)(\])/gm, '$1<span class="hl-section">$2</span>$3')
      // Keys
      .replace(/^(\s*)([a-zA-Z_][\w.-]*)(\s*=)/gm, '$1<span class="hl-key">$2</span>$3')
      // Values (strings in quotes)
      .replace(/(=)(\s*)("[^"]*"|'[^']*')/gm, '$1$2<span class="hl-string">$3</span>')
      // Values (numbers)
      .replace(/(=)(\s*)(\b\d+(?:\.\d+)?(?:MB|GB|KB|ms|s|m|h)?\b)/gm, '$1$2<span class="hl-number">$3</span>')
      // Values (booleans)
      .replace(/(=)(\s*)(\b(?:true|false|yes|no|on|off)\b)/gim, '$1$2<span class="hl-bool">$3</span>');
  }

  // Syntax highlighting for YAML
  function highlightYAML(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // Comments
      .replace(/(^|\n)(\s*)(#[^\n]*)/g, '$1$2<span class="hl-comment">$3</span>')
      // Keys (at start of line, before colon)
      .replace(/^(\s*)([a-zA-Z_][\w.-]*)(\s*:)/gm, '$1<span class="hl-key">$2</span>$3')
      // Strings in quotes
      .replace(/('[^']*'|"[^"]*")/g, '<span class="hl-string">$1</span>')
      // Numbers
      .replace(/(:\s+)((-?\d+(?:\.\d+)?(?:MB|GB|KB|ms|s|m|h)?\b))/gm, '$1<span class="hl-number">$3</span>')
      // Booleans
      .replace(/(:\s+)(\b(?:true|false|yes|no|on|off|null)\b)/gim, '$1<span class="hl-bool">$2</span>');
  }

  let displayYAML = $derived(highlightYAML(yamlText));
  let displayINI = $derived(highlightINI(iniText));
</script>

<div class="app" class:notepad-open={notepadOpen}>
  <!-- Header -->
  <header class="toolbar">
    <div class="toolbar-left">
      <h1 class="logo">
        <span class="logo-icon" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
          </svg>
        </span>
        <span class="logo-text">INI<span class="logo-arrow">→</span>YAML</span>
      </h1>
      <span class="eyebrow">Convertitore di configurazione</span>
    </div>

    <div class="toolbar-center">
      <div class="file-indicator" class:has-file={!!fileName}>
        {#if fileName}
          <Icon name="file" size={14} />
          <span class="file-name">{fileName}</span>
        {:else}
          <span class="no-file">Nessun file caricato</span>
        {/if}
      </div>
    </div>

    <div class="toolbar-right">
      <button class="btn btn-ghost" onclick={loadSample} aria-label="Carica esempio">
        <Icon name="book-open" size={14} />
        <span>Esempio</span>
      </button>
      <button class="btn btn-ghost" onclick={clearAll} aria-label="Pulisci tutto">
        <Icon name="trash" size={14} />
        <span>Pulisci</span>
      </button>
      <div class="separator" aria-hidden="true"></div>
      <button
        class="btn btn-primary"
        onclick={copyYAML}
        disabled={!yamlText}
        aria-label="Copia YAML negli appunti"
      >
        <Icon name={copyFeedback ? 'check' : 'copy'} size={14} />
        <span>{copyFeedback ? 'Copiato!' : 'Copia YAML'}</span>
      </button>
      <button
        class="btn btn-accent"
        onclick={downloadYAML}
        disabled={!yamlText}
        aria-label="Scarica file YAML"
      >
        <Icon name={downloadFeedback ? 'check' : 'download'} size={14} />
        <span>{downloadFeedback ? 'Scaricato!' : 'Scarica'}</span>
      </button>
      <button
        class="btn btn-ghost btn-notepad"
        class:active={notepadOpen}
        onclick={toggleNotepad}
        aria-label={notepadOpen ? 'Chiudi blocco note' : 'Apri blocco note'}
        aria-expanded={notepadOpen}
      >
        <Icon name="notepad" size={16} />
        <span>Note</span>
      </button>
    </div>
  </header>

  <!-- Main Content -->
  <main class="main-area">
    <div class="panels" class:drag-active={dragActive}>
      <!-- INI Panel -->
      <section
        class="panel panel-ini"
        style="width: {leftPanelWidth}%"
        aria-label="Editor INI"
      >
        <div class="panel-header">
          <div class="panel-badge badge-ini">INI</div>
          <h2 class="panel-title">Configurazione INI</h2>
          <label class="file-upload-label" for="ini-file-input" aria-label="Carica file INI">
            <Icon name="upload" size={14} />
            <span>Carica</span>
          </label>
        </div>
        <div class="editor-wrapper" role="region" aria-label="Zona di caricamento file INI" ondragover={handleDragOver} ondragleave={handleDragLeave} ondrop={handleDrop}>
          {#if dragActive}
            <div class="drop-overlay">
              <Icon name="upload" size={32} />
              <span>Rilascia il file .ini qui</span>
            </div>
          {/if}
          <!-- Hidden textarea for accessibility & editing -->
          <textarea
            bind:this={iniEditorEl}
            class="editor-textarea"
            value={iniText}
            oninput={onIniInput}
            spellcheck="false"
            aria-label="Contenuto INI"
            placeholder="; Scrivi o trascina qui il tuo file INI..."
          ></textarea>
          <!-- Syntax-highlighted overlay -->
          <pre class="editor-highlight" aria-hidden="true">{@html displayINI || '<span class="placeholder-text">; Scrivi o trascina qui il tuo file INI…</span>'}</pre>
        </div>
        {#if iniError}
          <div class="panel-error" role="alert">
            <Icon name="alert" size={14} />
            <span>{iniError}</span>
          </div>
        {/if}
        <input
          type="file"
          id="ini-file-input"
          class="sr-only"
          accept=".ini,.cfg,.conf,.txt"
          onchange={handleFileInput}
        />
      </section>

      <!-- Resize Handle -->
      <button
        type="button"
        class="resize-handle"
        aria-label="Ridimensiona pannelli. Freccia sinistra per ridurre, destra per aumentare."
        onmousedown={startResize}
        ontouchstart={startResize}
        onkeydown={(e) => {
          if (e.key === 'ArrowLeft') { leftPanelWidth = Math.max(25, leftPanelWidth - 2); e.preventDefault(); }
          if (e.key === 'ArrowRight') { leftPanelWidth = Math.min(75, leftPanelWidth + 2); e.preventDefault(); }
        }}
      >
        <div class="handle-grip" aria-hidden="true">
          <span></span><span></span><span></span>
        </div>
      </button>

      <!-- YAML Panel -->
      <section
        class="panel panel-yaml"
        style="width: {100 - leftPanelWidth}%"
        aria-label="Risultato YAML"
      >
        <div class="panel-header">
          <div class="panel-badge badge-yaml">YAML</div>
          <h2 class="panel-title">Risultato YAML</h2>
          <span class="chars-count">{yamlText.length} caratteri</span>
        </div>
        <div class="editor-wrapper read-only">
          <pre class="editor-highlight yaml-output" aria-hidden="true">{@html displayYAML || '<span class="placeholder-text">Il risultato YAML appare qui in tempo reale…</span>'}</pre>
          <textarea
            bind:this={yamlEditorEl}
            class="editor-textarea sr-only"
            value={yamlText}
            readonly
            aria-label="Contenuto YAML"
          ></textarea>
        </div>
      </section>
    </div>
  </main>

  <!-- Notepad Sidebar -->
  <Notepad bind:open={notepadOpen} onclose={() => { notepadOpen = false; }} />
</div>

<style>
  /* ── Design Tokens ── */
  :root {
    --color-bg: #F8FAFC;
    --color-surface: #FFFFFF;
    --color-border: #E2E8F0;
    --color-border-light: #F1F5F9;
    --color-text: #1E293B;
    --color-text-muted: #64748B;
    --color-primary: #0D7C85;
    --color-primary-light: #14B8A6;
    --color-primary-bg: #ECFEFF;
    --color-accent: #D9465C;
    --color-accent-bg: #FFF1F2;
    --color-amber: #B45309;
    --color-amber-bg: #FFFBEB;
    --color-success: #059669;
    --color-ini: #7C3AED;
    --color-ini-bg: #F5F3FF;
    --color-yaml: #0284C7;
    --color-yaml-bg: #F0F9FF;
    --color-focus: #0D7C85;
    --radius-sm: 6px;
    --radius-md: 8px;
    --radius-lg: 12px;
    --shadow-sm: 0 1px 2px rgba(0,0,0,0.04);
    --shadow-md: 0 4px 12px rgba(0,0,0,0.06);
    --transition-fast: 150ms ease;
    --transition-normal: 250ms ease;
  }

  * {
    box-sizing: border-box;
  }

  .app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    height: 100dvh;
    background: var(--color-bg);
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    color: var(--color-text);
    overflow: hidden;
  }

  /* ── Toolbar ── */
  .toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: var(--color-surface);
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
    z-index: 10;
    min-height: 52px;
  }

  .toolbar-left {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 6px;
    font-family: 'Outfit', 'Inter', sans-serif;
    font-size: 18px;
    font-weight: 700;
    color: var(--color-text);
    margin: 0;
    line-height: 1;
  }

  .logo-icon {
    color: var(--color-primary);
  }

  .logo-arrow {
    color: var(--color-primary-light);
    margin: 0 1px;
  }

  .eyebrow {
    font-size: 11px;
    font-weight: 500;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.6px;
    white-space: nowrap;
  }

  .toolbar-center {
    flex: 1;
    display: flex;
    justify-content: center;
  }

  .file-indicator {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--color-text-muted);
    padding: 4px 10px;
    border-radius: var(--radius-sm);
    background: var(--color-bg);
    border: 1px solid var(--color-border-light);
  }

  .file-indicator.has-file {
    color: var(--color-primary);
    background: var(--color-primary-bg);
    border-color: #99F6E4;
  }

  .file-name {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .no-file {
    font-style: italic;
  }

  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  .separator {
    width: 1px;
    height: 24px;
    background: var(--color-border);
    margin: 0 4px;
  }

  /* ── Buttons ── */
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 12px;
    border-radius: var(--radius-sm);
    font-family: 'Inter', sans-serif;
    font-size: 13px;
    font-weight: 500;
    line-height: 1;
    border: 1px solid transparent;
    cursor: pointer;
    transition: all var(--transition-fast);
    white-space: nowrap;
    min-height: 36px;
    min-width: 36px;
    background: transparent;
    color: var(--color-text);
  }

  .btn:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
  }

  .btn-ghost {
    color: var(--color-text-muted);
  }

  .btn-ghost:hover {
    background: var(--color-bg);
    color: var(--color-text);
  }

  .btn-primary {
    background: var(--color-primary);
    color: white;
  }

  .btn-primary:hover {
    background: #0B6B73;
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-accent {
    background: var(--color-accent);
    color: white;
  }

  .btn-accent:hover {
    background: #C93548;
  }

  .btn-accent:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-notepad.active {
    background: var(--color-amber-bg);
    color: var(--color-amber);
    border-color: #FDE68A;
  }

  /* ── Main Area ── */
  .main-area {
    flex: 1;
    overflow: hidden;
    display: flex;
  }

  .panels {
    display: flex;
    flex: 1;
    position: relative;
    transition: opacity var(--transition-normal);
  }

  /* ── Panel ── */
  .panel {
    display: flex;
    flex-direction: column;
    min-width: 0;
    transition: width 200ms ease;
  }

  .panel-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--color-surface);
    border-bottom: 1px solid var(--color-border-light);
    flex-shrink: 0;
    min-height: 40px;
  }

  .panel-badge {
    font-family: 'Outfit', sans-serif;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    padding: 2px 8px;
    border-radius: 4px;
    line-height: 1.5;
  }

  .badge-ini {
    background: var(--color-ini-bg);
    color: var(--color-ini);
  }

  .badge-yaml {
    background: var(--color-yaml-bg);
    color: var(--color-yaml);
  }

  .panel-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-text-muted);
    margin: 0;
    flex: 1;
  }

  .chars-count {
    font-size: 11px;
    color: var(--color-text-muted);
    font-family: 'JetBrains Mono', monospace;
  }

  .file-upload-label {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 500;
    color: var(--color-ini);
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
    transition: background var(--transition-fast);
  }

  .file-upload-label:hover,
  .file-upload-label:focus-visible {
    background: var(--color-ini-bg);
  }

  .file-upload-label:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: 1px;
  }

  /* ── Editor ── */
  .editor-wrapper {
    flex: 1;
    position: relative;
    overflow: hidden;
    background: var(--color-surface);
  }

  .editor-wrapper.read-only {
    background: #FAFBFC;
  }

  .editor-textarea,
  .editor-highlight {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    padding: 12px 16px;
    margin: 0;
    border: none;
    outline: none;
    resize: none;
    font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
    font-size: 13px;
    line-height: 1.7;
    tab-size: 4;
    white-space: pre-wrap;
    word-wrap: break-word;
    overflow-wrap: break-word;
    overflow-y: auto;
    background: transparent;
  }

  .editor-textarea {
    color: transparent;
    caret-color: var(--color-text);
    z-index: 2;
    -webkit-text-fill-color: transparent;
  }

  .editor-textarea::placeholder {
    color: var(--color-text-muted);
    opacity: 0.5;
    -webkit-text-fill-color: var(--color-text-muted);
  }

  .editor-textarea:focus {
    outline: none;
  }

  .editor-highlight {
    z-index: 1;
    color: var(--color-text);
    pointer-events: none;
    overflow-y: auto;
    white-space: pre-wrap;
  }

  .yaml-output {
    color: var(--color-text);
    user-select: text;
    pointer-events: auto;
  }

  /* ── Syntax Highlighting ── */
  :global(.hl-comment) { color: #94A3B8; font-style: italic; }
  :global(.hl-section) { color: #7C3AED; font-weight: 600; }
  :global(.hl-key) { color: #0D7C85; font-weight: 500; }
  :global(.hl-string) { color: #D9465C; }
  :global(.hl-number) { color: #0284C7; }
  :global(.hl-bool) { color: #7C3AED; font-weight: 500; }
  :global(.placeholder-text) { color: #94A3B8; font-style: italic; opacity: 0.6; }
  :global(.hl-bracket) { color: #64748B; }

  /* ── Drop Overlay ── */
  .drop-overlay {
    position: absolute;
    inset: 0;
    z-index: 10;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: rgba(13, 124, 133, 0.06);
    border: 2px dashed var(--color-primary);
    border-radius: 0;
    color: var(--color-primary);
    font-weight: 600;
    font-size: 14px;
    pointer-events: none;
  }

  /* ── Resize Handle ── */
  .resize-handle {
    width: 8px;
    flex-shrink: 0;
    background: var(--color-border-light);
    cursor: col-resize;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background var(--transition-fast);
    position: relative;
    z-index: 5;
    border: none;
    padding: 0;
    margin: 0;
    font: inherit;
    color: inherit;
  }

  .resize-handle:hover,
  .resize-handle:focus-visible {
    background: #99F6E4;
  }

  .resize-handle:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: -2px;
  }

  .handle-grip {
    display: flex;
    flex-direction: column;
    gap: 3px;
    opacity: 0.4;
    transition: opacity var(--transition-fast);
  }

  .resize-handle:hover .handle-grip {
    opacity: 0.8;
  }

  .handle-grip span {
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: var(--color-primary);
  }

  /* ── Panel Error ── */
  .panel-error {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: #FFF1F2;
    color: #BE123C;
    font-size: 12px;
    font-weight: 500;
    border-top: 1px solid #FECDD3;
    flex-shrink: 0;
  }

  /* ── SR Only ── */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  /* ── Responsive ── */
  @media (max-width: 768px) {
    .toolbar {
      flex-wrap: wrap;
      gap: 4px;
      padding: 6px 8px;
      min-height: auto;
    }

    .toolbar-left {
      width: 100%;
      justify-content: space-between;
    }

    .toolbar-center {
      display: none;
    }

    .toolbar-right {
      width: 100%;
      justify-content: flex-end;
      flex-wrap: wrap;
    }

    .btn span {
      display: none;
    }

    .btn {
      padding: 7px;
      min-width: 36px;
      justify-content: center;
    }

    .btn-primary span,
    .btn-accent span {
      display: inline;
    }

    .panels {
      flex-direction: column;
    }

    .panel {
      width: 100% !important;
      height: 50%;
    }

    .resize-handle {
      width: 100%;
      height: 8px;
      cursor: row-resize;
    }

    .handle-grip {
      flex-direction: row;
    }
  }

  /* ── Reduced Motion ── */
  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
</style>
