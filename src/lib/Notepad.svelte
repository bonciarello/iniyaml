<script>
  import Icon from './Icon.svelte';

  let { open = false, onclose } = $props();

  let noteText = $state('');

  // Load from localStorage
  $effect(() => {
    try {
      const saved = localStorage.getItem('ini-yaml-notepad');
      if (saved !== null) {
        noteText = saved;
      }
    } catch {
      // localStorage not available
    }
  });

  // Auto-save with debounce
  let saveTimer = null;

  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem('ini-yaml-notepad', noteText);
      } catch {
        // Ignore storage errors
      }
      saveTimer = null;
    }, 400);
  }

  function onInput(e) {
    noteText = e.target.value;
    scheduleSave();
  }

  function handleClose() {
    onclose?.();
  }

  function clearNotes() {
    noteText = '';
    try {
      localStorage.removeItem('ini-yaml-notepad');
    } catch { /* ignore */ }
  }
</script>

{#if open}
  <aside class="notepad" aria-label="Blocco note">
    <div class="notepad-header">
      <div class="notepad-title-group">
        <Icon name="notepad" size={16} />
        <h2 class="notepad-title">Blocco Note</h2>
      </div>
      <div class="notepad-actions">
        <button
          class="btn-notepad-action"
          onclick={clearNotes}
          aria-label="Cancella tutte le note"
          title="Cancella tutto"
        >
          <Icon name="trash" size={14} />
        </button>
        <button
          class="btn-notepad-action btn-notepad-close"
          onclick={handleClose}
          aria-label="Chiudi blocco note"
          title="Chiudi"
        >
          <Icon name="x" size={16} />
        </button>
      </div>
    </div>
    <div class="notepad-body">
      <label for="notepad-textarea" class="sr-only">Appunti personali</label>
      <textarea
        id="notepad-textarea"
        class="notepad-textarea"
        value={noteText}
        oninput={onInput}
        placeholder="Scrivi qui i tuoi appunti…"
        spellcheck="true"
      ></textarea>
    </div>
    <div class="notepad-footer">
      <span class="notepad-hint">Salvataggio automatico</span>
      <span class="notepad-chars">{noteText.length} caratteri</span>
    </div>
  </aside>
{/if}

<style>
  .notepad {
    width: 280px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    background: #FFFBEB;
    border-left: 1px solid #FDE68A;
    animation: slideIn 250ms ease;
    height: 100%;
  }

  @keyframes slideIn {
    from {
      width: 0;
      opacity: 0;
    }
    to {
      width: 280px;
      opacity: 1;
    }
  }

  .notepad-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    border-bottom: 1px solid #FDE68A;
    flex-shrink: 0;
  }

  .notepad-title-group {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #B45309;
  }

  .notepad-title {
    font-family: 'Outfit', sans-serif;
    font-size: 14px;
    font-weight: 600;
    color: #92400E;
    margin: 0;
  }

  .notepad-actions {
    display: flex;
    gap: 2px;
  }

  .btn-notepad-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    background: transparent;
    color: #B45309;
    cursor: pointer;
    border-radius: 6px;
    transition: background 150ms ease;
  }

  .btn-notepad-action:hover {
    background: #FDE68A;
  }

  .btn-notepad-action:focus-visible {
    outline: 2px solid #B45309;
    outline-offset: 1px;
  }

  .notepad-body {
    flex: 1;
    overflow: hidden;
  }

  .notepad-textarea {
    width: 100%;
    height: 100%;
    border: none;
    outline: none;
    resize: none;
    padding: 12px;
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 13px;
    line-height: 1.65;
    color: #78350F;
    background: transparent;
  }

  .notepad-textarea::placeholder {
    color: #D4A574;
    font-style: italic;
  }

  .notepad-textarea:focus {
    outline: none;
  }

  .notepad-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 12px;
    border-top: 1px solid #FDE68A;
    flex-shrink: 0;
    font-size: 10px;
    color: #B45309;
    opacity: 0.7;
  }

  .notepad-hint {
    font-style: italic;
  }

  .notepad-chars {
    font-family: 'JetBrains Mono', monospace;
  }

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

  @media (max-width: 768px) {
    .notepad {
      width: 100%;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 100;
    }

    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateX(100%);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .notepad {
      animation: none;
    }
  }
</style>
