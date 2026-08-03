<script lang="ts">
  import type { StoredMedia, MediaConfig } from '../core/types.js';

  interface Props {
    onUpload: (file: File) => Promise<StoredMedia>;
    onError?: (message: string) => void;
    maxFiles?: number;
    accept?: string;
    config?: MediaConfig;
  }

  let {
    onUpload,
    onError,
    maxFiles = 1,
    accept = 'image/jpeg,image/png,image/webp',
  }: Props = $props();

  let dragging = $state(false);
  let uploading = $state(false);
  let input: HTMLInputElement;

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    uploading = true;
    try {
      for (const file of Array.from(files).slice(0, maxFiles)) {
        await onUpload(file);
      }
    } catch (e) {
      onError?.(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      uploading = false;
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    dragging = false;
    handleFiles(e.dataTransfer?.files ?? null);
  }
</script>

<div
  class="asini-upload"
  class:asini-upload--drag={dragging}
  class:asini-upload--busy={uploading}
  role="region"
  aria-label="Image upload"
  ondragover={(e) => { e.preventDefault(); dragging = true; }}
  ondragleave={() => { dragging = false; }}
  ondrop={onDrop}
>
  {#if uploading}
    <span class="asini-upload__status">Uploading…</span>
  {:else}
    <button
      type="button"
      class="asini-upload__btn"
      onclick={() => input.click()}
      aria-label="Select image"
    >
      Choose image
    </button>
    <span class="asini-upload__hint">or drag and drop</span>
  {/if}
  <input
    bind:this={input}
    type="file"
    {accept}
    multiple={maxFiles > 1}
    style="display:none"
    onchange={(e) => handleFiles((e.target as HTMLInputElement).files)}
  />
</div>

<style>
  .asini-upload {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 2rem;
    border: 2px dashed var(--asini-border);
    border-radius: var(--asini-radius);
    background: var(--asini-surface);
    color: var(--asini-text-2);
    transition: border-color 0.15s, background 0.15s;
    cursor: pointer;
  }
  .asini-upload--drag {
    border-color: var(--asini-accent);
    background: var(--asini-accent-muted);
  }
  .asini-upload--busy {
    opacity: 0.6;
    pointer-events: none;
  }
  .asini-upload__btn {
    padding: 0.5rem 1.25rem;
    border: 1px solid var(--asini-border);
    border-radius: var(--asini-radius-sm);
    background: var(--asini-bg);
    color: var(--asini-text);
    font-size: 0.875rem;
    cursor: pointer;
  }
  .asini-upload__btn:hover {
    border-color: var(--asini-accent);
    color: var(--asini-accent);
  }
  .asini-upload__hint {
    font-size: 0.8rem;
    color: var(--asini-text-3);
  }
  .asini-upload__status {
    font-size: 0.875rem;
    color: var(--asini-text-2);
  }
</style>
