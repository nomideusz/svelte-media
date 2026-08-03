<script lang="ts">
    import type { StoredMedia } from "../core/types.js";

    interface Props {
        images: StoredMedia[];
        getUrl: (
            prefix: string,
            entityId: string,
            filename: string,
            size: "thumbnail" | "medium" | "large",
        ) => string;
        onDelete?: (filename: string) => void;
        size?: "thumbnail" | "medium";
    }

    let { images, getUrl, onDelete, size = "thumbnail" }: Props = $props();

    let expanded: StoredMedia | null = $state(null);
</script>

{#if images.length > 0}
    <div class="asini-gallery">
        {#each images as img (img.filename)}
            <div class="asini-gallery__item">
                <button
                    type="button"
                    class="asini-gallery__thumb-btn"
                    onclick={() => {
                        expanded = img;
                    }}
                    aria-label="View {img.originalName}"
                >
                    <img
                        src={getUrl(
                            img.prefix,
                            img.entityId,
                            img.filename,
                            size,
                        )}
                        alt={img.originalName}
                        class="asini-gallery__thumb"
                        loading="lazy"
                    />
                </button>
                {#if onDelete}
                    <button
                        type="button"
                        class="asini-gallery__delete"
                        onclick={() => onDelete?.(img.filename)}
                        aria-label="Delete {img.originalName}">×</button
                    >
                {/if}
            </div>
        {/each}
    </div>
{/if}

{#if expanded}
    <div
        class="asini-lightbox"
        role="dialog"
        aria-modal="true"
        aria-label="Image preview"
        onclick={() => {
            expanded = null;
        }}
        onkeydown={(e) => {
            if (e.key === "Escape") expanded = null;
        }}
        tabindex="-1"
    >
        <div
            class="asini-lightbox__img-wrap"
            role="presentation"
            onclick={(e) => {
                e.stopPropagation();
            }}
        >
            <img
                src={getUrl(
                    expanded.prefix,
                    expanded.entityId,
                    expanded.filename,
                    "large",
                )}
                alt={expanded.originalName}
                class="asini-lightbox__img"
            />
        </div>
    </div>
{/if}

<style>
    .asini-gallery {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
    }
    .asini-gallery__item {
        position: relative;
        display: inline-block;
    }
    .asini-gallery__thumb-btn {
        display: block;
        border: none;
        padding: 0;
        cursor: pointer;
        border-radius: var(--asini-radius-sm);
        overflow: hidden;
    }
    .asini-gallery__thumb {
        display: block;
        width: 100px;
        height: 100px;
        object-fit: cover;
        border-radius: var(--asini-radius-sm);
        border: 1px solid var(--asini-border);
    }
    .asini-gallery__delete {
        position: absolute;
        top: 2px;
        right: 2px;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: var(--asini-danger);
        color: #fff;
        border: none;
        font-size: 14px;
        line-height: 1;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .asini-lightbox {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        cursor: pointer;
    }
    .asini-lightbox__img-wrap {
        display: flex;
        align-items: center;
        justify-content: center;
        outline: none;
    }
    .asini-lightbox__img {
        max-width: 90vw;
        max-height: 90vh;
        object-fit: contain;
        border-radius: var(--asini-radius);
        cursor: default;
    }
</style>
