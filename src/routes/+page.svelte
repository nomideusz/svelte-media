<script lang="ts">
	import {
		ImageUpload,
		ImageGallery,
		validateImageFile,
		generateMediaKey,
		getStorageKey,
		IMAGE_SIZES,
		type StoredMedia,
		type ImageSize,
	} from '$lib/index.js';

	// ── Validation playground (the real function, running in your browser) ──
	let maxMb = $state(5);
	let allowPng = $state(true);
	let lastCheck = $state<
		{ name: string; size: number; type: string; valid: boolean; error?: string } | null
	>(null);

	const allowedTypes = $derived(
		allowPng
			? ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
			: ['image/jpeg', 'image/jpg', 'image/webp'],
	);

	function check(file: File) {
		const result = validateImageFile(file, {
			maxFileSize: maxMb * 1024 * 1024,
			allowedTypes,
		});
		lastCheck = { name: file.name, size: file.size, type: file.type, ...result };
		return result;
	}

	// ── Key layout (real helpers) ──
	let prefix = $state('tours');
	let entityId = $state('tour_8fa21c');
	const sampleFilename = 'mn4k2p8qw1x7.webp';
	const SIZES: ImageSize[] = ['original', 'thumbnail', 'medium', 'large'];

	// ── Components, with an in-browser stand-in for the server upload ──
	// processAndStore needs sharp and Node's Buffer, so it cannot run here. The
	// stand-in returns the same StoredMedia shape the real pipeline would, so
	// the components behave exactly as they do in an app.
	let images = $state<StoredMedia[]>([]);
	let objectUrls = $state<Record<string, string>>({});
	let uploadError = $state<string | null>(null);

	async function fakeUpload(file: File): Promise<StoredMedia> {
		const result = check(file);
		if (!result.valid) throw new Error(result.error);

		const filename = generateMediaKey();
		const stored: StoredMedia = {
			filename,
			originalName: file.name,
			prefix,
			entityId,
			sizes: Object.fromEntries(
				SIZES.map((s) => [s, getStorageKey(prefix, entityId, filename, s)]),
			) as Record<ImageSize, string>,
		};
		objectUrls = { ...objectUrls, [filename]: URL.createObjectURL(file) };
		images = [...images, stored];
		uploadError = null;
		return stored;
	}

	function removeImage(filename: string) {
		URL.revokeObjectURL(objectUrls[filename]);
		images = images.filter((i) => i.filename !== filename);
	}

	const fmtBytes = (n: number) =>
		n < 1024
			? `${n} B`
			: n < 1024 ** 2
				? `${(n / 1024).toFixed(1)} kB`
				: `${(n / 1024 ** 2).toFixed(2)} MB`;
</script>

<svelte:head>
	<title>@nomideusz/svelte-media — image upload &amp; multi-size storage</title>
	<meta
		name="description"
		content="Image upload, sharp resizing and S3-compatible storage for Svelte 5 apps. One call validates a File, renders four sizes and writes them through a pluggable storage adapter."
	/>
</svelte:head>

<main>
	<header>
		<h1>@nomideusz/svelte-media</h1>
		<p class="lede">
			Take a <code>File</code>, validate it, render four sizes with sharp, and write each one
			through a pluggable storage adapter. The variable part is only <em>where</em> the bytes go.
		</p>
		<p class="install"><code>pnpm add @nomideusz/svelte-media</code></p>
		<p class="scope">
			The resizing pipeline is server-only — it needs sharp and Node's <code>Buffer</code>. What
			runs on this page is the client half: validation, key generation, and the two components.
		</p>
	</header>

	<section>
		<h2>Upload &amp; gallery</h2>
		<p class="muted">
			Both components, live. Files stay in your browser — the upload handler here returns the same
			<code>StoredMedia</code> shape the server pipeline would.
		</p>

		<ImageUpload
			onUpload={fakeUpload}
			onError={(m) => (uploadError = m)}
			maxFiles={4}
			config={{ maxFileSize: maxMb * 1024 * 1024, allowedTypes }}
		/>

		{#if uploadError}
			<p class="error">{uploadError}</p>
		{/if}

		{#if images.length}
			<div class="gallery-wrap">
				<ImageGallery
					{images}
					getUrl={(_p, _e, filename) => objectUrls[filename]}
					onDelete={removeImage}
					size="thumbnail"
				/>
			</div>
		{:else}
			<p class="empty">Drop an image above to populate the gallery.</p>
		{/if}
	</section>

	<section>
		<h2>Validation</h2>
		<p class="muted">
			<code>validateImageFile</code> is a pure function — this is it running, not a
			reimplementation. Change the limits and drop a file that should fail.
		</p>

		<div class="controls">
			<label>
				Max size (MB)
				<input type="number" min="0.01" step="0.5" bind:value={maxMb} />
			</label>
			<label class="check">
				<input type="checkbox" bind:checked={allowPng} />
				allow image/png
			</label>
		</div>

		{#if lastCheck}
			<div class="verdict" class:bad={!lastCheck.valid}>
				<strong>{lastCheck.valid ? 'valid' : 'rejected'}</strong>
				<span class="file">{lastCheck.name}</span>
				<span class="meta">{fmtBytes(lastCheck.size)} · {lastCheck.type || 'unknown type'}</span>
				{#if lastCheck.error}<span class="why">{lastCheck.error}</span>{/if}
			</div>
		{:else}
			<p class="empty">No file checked yet.</p>
		{/if}
	</section>

	<section>
		<h2>Sizes &amp; storage keys</h2>
		<p class="muted">
			Every upload writes four variants. <code>cover</code> crops to fill; <code>inside</code> fits
			within the box and keeps aspect ratio, so medium and large are upper bounds.
		</p>

		<div class="controls">
			<label>prefix <input bind:value={prefix} /></label>
			<label>entityId <input bind:value={entityId} /></label>
		</div>

		<div class="table-wrap">
			<table>
				<thead>
					<tr><th>size</th><th>dimensions</th><th>fit</th><th>key</th></tr>
				</thead>
				<tbody>
					{#each SIZES as size (size)}
						<tr>
							<td><code>{size}</code></td>
							<td>
								{#if size === 'original'}—{:else}{IMAGE_SIZES[size].width}×{IMAGE_SIZES[size]
										.height}{/if}
							</td>
							<td>{size === 'original' ? '—' : IMAGE_SIZES[size].fit}</td>
							<td
								><code class="key">{getStorageKey(prefix, entityId, sampleFilename, size)}</code
								></td
							>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="muted small">
			Filenames come from <code>generateMediaKey()</code> — a cuid2 with a <code>.webp</code>
			extension, because output is always WebP whatever went in.
		</p>
	</section>

	<section>
		<h2>Server: the pipeline</h2>
		<p class="muted">
			Not runnable here — this is the half that needs sharp. Call it from a route handler; the
			credentials never leave the server.
		</p>
		<pre><code>{`import { createS3Adapter, processAndStore } from '@nomideusz/svelte-media';

const storage = createS3Adapter({
  endpoint: env.S3_ENDPOINT, region: 'auto', bucket: env.S3_BUCKET,
  accessKeyId: env.S3_KEY, secretAccessKey: env.S3_SECRET,
  publicUrl: env.S3_PUBLIC_URL, forcePathStyle: true,   // false for AWS/Railway
});

// Validates, resizes to 4 sizes, uploads each, returns the keys
const stored = await processAndStore(storage, file, 'tours', tourId);

await deleteMedia(storage, stored.prefix, stored.entityId, stored.filename);`}</code></pre>
		<p class="muted small">
			<code>createLocalAdapter(&lbrace; root &rbrace;)</code> swaps S3 for disk in development. Any
			object with <code>put</code>, <code>delete</code> and <code>getUrl</code> works.
		</p>
	</section>

	<footer>
		<a href="https://github.com/nomideusz/svelte-media">GitHub</a>
		<a href="https://www.npmjs.com/package/@nomideusz/svelte-media">npm</a>
	</footer>
</main>

<style>
	:global(body) {
		margin: 0;
		background: #fbfbfa;
		color: #1a1a1a;
		font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
		line-height: 1.6;
	}
	main {
		max-width: 54rem;
		margin: 0 auto;
		padding: 3rem 1.5rem 4rem;
	}
	h1 {
		font-size: 1.75rem;
		margin: 0 0 0.5rem;
		letter-spacing: -0.02em;
	}
	h2 {
		font-size: 1.1rem;
		margin: 0 0 0.4rem;
	}
	.lede {
		margin: 0 0 0.75rem;
		color: #4a4a4a;
	}
	.scope {
		font-size: 0.88rem;
		color: #6a6a6a;
		border-left: 2px solid #ddd9d0;
		padding-left: 0.85rem;
		margin: 1rem 0 0;
	}
	.muted {
		color: #666;
		font-size: 0.92rem;
	}
	.small {
		font-size: 0.85rem;
	}
	.empty {
		color: #999;
		font-size: 0.9rem;
		font-style: italic;
	}
	code {
		background: #f0efec;
		padding: 0.15em 0.4em;
		border-radius: 4px;
		font-size: 0.9em;
	}
	a {
		color: #1a1a1a;
	}
	section {
		margin-top: 2.5rem;
		padding-top: 1.5rem;
		border-top: 1px solid #e6e4df;
	}
	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		margin: 0.9rem 0;
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		font-size: 0.8rem;
		color: #666;
	}
	label.check {
		flex-direction: row;
		align-items: center;
		gap: 0.45rem;
		align-self: end;
		padding-bottom: 0.45rem;
		color: #1a1a1a;
	}
	input {
		font: inherit;
		font-size: 0.9rem;
		padding: 0.4rem 0.5rem;
		border: 1px solid #d8d5ce;
		border-radius: 6px;
		background: #fff;
		min-width: 9rem;
	}
	input[type='checkbox'] {
		min-width: 0;
	}
	.gallery-wrap {
		margin-top: 1.25rem;
	}
	.error {
		color: #a4271c;
		font-size: 0.9rem;
	}
	.verdict {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.6rem;
		padding: 0.7rem 0.9rem;
		border-radius: 8px;
		background: #eef6ee;
		border: 1px solid #cfe3cf;
		font-size: 0.9rem;
	}
	.verdict.bad {
		background: #fbeeec;
		border-color: #edcdc7;
	}
	.verdict .file {
		font-family: ui-monospace, monospace;
	}
	.verdict .meta {
		color: #666;
		font-size: 0.85rem;
	}
	.verdict .why {
		flex-basis: 100%;
		color: #a4271c;
	}
	.table-wrap {
		overflow-x: auto;
	}
	table {
		border-collapse: collapse;
		width: 100%;
		font-size: 0.86rem;
	}
	th,
	td {
		text-align: left;
		padding: 0.5rem 0.7rem;
		border-bottom: 1px solid #e6e4df;
		white-space: nowrap;
	}
	th {
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #8a8a8a;
	}
	.key {
		font-size: 0.8rem;
	}
	pre {
		background: #1e1e1c;
		color: #eceae4;
		padding: 1rem 1.15rem;
		border-radius: 10px;
		overflow-x: auto;
		font-size: 0.82rem;
		line-height: 1.55;
	}
	pre code {
		background: none;
		padding: 0;
		font-size: inherit;
	}
	footer {
		margin-top: 3rem;
		padding-top: 1.25rem;
		border-top: 1px solid #e6e4df;
		display: flex;
		gap: 1.25rem;
		font-size: 0.9rem;
	}
	@media (prefers-color-scheme: dark) {
		:global(body) {
			background: #17171a;
			color: #e8e6e3;
		}
		a,
		label.check {
			color: #e8e6e3;
		}
		.lede,
		.muted,
		.scope {
			color: #a8a5a0;
		}
		.scope {
			border-color: #3a3a42;
		}
		code {
			background: #2a2a30;
		}
		input {
			background: #2a2a30;
			border-color: #3d3d45;
			color: #e8e6e3;
		}
		section,
		footer,
		th,
		td {
			border-color: #33333a;
		}
		.verdict {
			background: #1d2a1d;
			border-color: #2f4630;
		}
		.verdict.bad {
			background: #2c1d1b;
			border-color: #4a2f2b;
		}
	}
</style>
