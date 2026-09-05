import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);

// The DOM layer only exists in a browser, so it is checked in one: a static
// server plus the headless Chrome already on the machine. No dependency, and
// it skips rather than fails where there is no browser.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const TYPES = {
	'.html': 'text/html',
	'.js': 'text/javascript',
	'.css': 'text/css',
	'.png': 'image/png',
	'.ico': 'image/vnd.microsoft.icon',
	'.xml': 'application/xml',
	'.txt': 'text/plain',
};

function browser() {
	for (const candidate of [
		'google-chrome',
		'google-chrome-stable',
		'chromium',
		'chromium-browser',
	]) {
		try {
			execFileSync('which', [candidate], { stdio: 'ignore' });
			return candidate;
		} catch {
			// Try the next one.
		}
	}
	return null;
}

const CHROME = browser();
const options = CHROME ? {} : { skip: 'no headless browser found' };

const PROBE = (target) => `<!DOCTYPE html><html><head><title>pending</title></head><body>
<iframe id="f" src="${target}"></iframe>
<script>
	setTimeout(() => { document.title = document.getElementById('f').contentWindow.location.href; }, 2000);
</script>
</body></html>`;

const server = createServer(async (request, response) => {
	const url = new URL(request.url, 'http://localhost');
	if (url.pathname === '/__probe') {
		response.writeHead(200, { 'content-type': 'text/html' });
		response.end(PROBE(url.searchParams.get('target')));
		return;
	}
	const path = normalize(decodeURIComponent(url.pathname));
	const file = join(ROOT, path === '/' ? 'index.html' : path);
	try {
		const body = await readFile(file);
		response.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
		response.end(body);
	} catch {
		response.writeHead(404).end();
	}
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
after(() => server.close());

// Asynchronous on purpose. The static server runs in this same process, so a
// synchronous child would block the event loop and the page would never be
// served to the browser waiting for it.
async function render(path) {
	const { stdout } = await run(
		CHROME,
		[
			'--headless',
			'--disable-gpu',
			'--no-sandbox',
			'--virtual-time-budget=8000',
			'--dump-dom',
			`${origin}${path}`,
		],
		{ encoding: 'utf8', timeout: 60000, maxBuffer: 32 * 1024 * 1024 },
	);
	return stdout;
}

const descriptions = (dom) =>
	[...dom.matchAll(/<p class="description">([^<]*)</g)].map((m) => m[1]);

test('the sample crontab is explained on load', options, async () => {
	const dom = await render('/');
	assert.deepEqual(descriptions(dom), [
		'Every 15 minutes',
		'Every Sunday at 3:00 AM',
		'Every day at 12:00 AM',
		'Once at system startup',
	]);
	assert.match(dom, /Next 5 runs/);
});

test('a shared link fills in its schedule and titles the page after it', options, async () => {
	const dom = await render('/index.html?e=0+9-17+*+*+MON-FRI');
	assert.deepEqual(descriptions(dom), ['Every hour from 9:00 AM to 5:00 PM, on weekdays']);
	assert.match(
		dom,
		/<title>0 9-17 \* \* MON-FRI — Every hour from 9:00 AM to 5:00 PM, on weekdays · cron -h/,
	);
});

test('a shared link carries its language', options, async () => {
	const dom = await render('/index.html?e=0+3+*+*+0&lang=es');
	assert.deepEqual(descriptions(dom), ['Los domingos a las 3:00']);
	assert.match(dom, /El intérprete de cron legible por humanos\./);
	assert.match(dom, /Próximas 5 ejecuciones/);
	assert.match(dom, /id="examples" href="es\/examples\.html"/);
});

test('an unparseable line is reported rather than swallowed', options, async () => {
	const dom = await render('/index.html?e=nonsense');
	assert.match(dom, /class="entry error"/);
});

// The i18n bundle is fetched only for a non-English reader, and only for
// schedules no recognizer claims. Hard-coding the "already loaded" flag either
// way passed the whole suite, while leaving a Spanish reader on English
// forever. This is the only test that exercises that path end to end.
test('an unrecognized schedule is still translated', options, async () => {
	const dom = await render('/index.html?e=*%2F15+*+1+*+*&lang=es');
	const shown = [...dom.matchAll(/<p class="description">([^<]*)</g)].map((m) => m[1]);
	assert.equal(shown.length, 1);
	assert.doesNotMatch(shown[0], /^Every /, 'fell back to English');
	assert.match(shown[0], /minutos/, 'the translated fallback arrived');
});

test('the page a crawler sees carries its card and canonical', options, async () => {
	const dom = await render('/');
	assert.match(dom, /<meta property="og:image" content="https:\/\/cron-h\.com\/og\.png"/);
	assert.match(dom, /<link rel="canonical" href="https:\/\/cron-h\.com\/"/);
	assert.match(dom, /name="twitter:card" content="summary_large_image"/);
});

test('an error is reported in the reader’s language', options, async () => {
	const dom = await render('/index.html?e=60+*+*+*+*&lang=ru');
	assert.match(dom, /class="entry error"/);
	assert.match(dom, /cron не принял бы эту строку/);
	// Not croner's or cronstrue's own wording, which leaked a class name and a
	// doubled "Error:" prefix into a box already labelled as an error.
	assert.doesNotMatch(dom, /CronPattern|Error: Error/);
});

test('the URL keeps what it was given', options, async () => {
	// Rebuilding the query from the path alone discarded the fragment and every
	// other parameter, and cleared `e` for anything that was not exactly one
	// schedule — so a reload threw the reader's input away.
	const target = encodeURIComponent('/index.html?ref=news&e=0+3+*+*+0#top');
	const dom = await render(`/__probe?target=${target}`);
	const [, href] = dom.match(/<title>([^<]*)</);

	assert.match(href, /ref=news/, 'other parameters survive');
	assert.match(href, /e=0\+3\+\*\+\*\+0/, 'the schedule is still there');
	assert.match(href, /#top$/, 'and so does the fragment');
});

test('the results list announces itself to a screen reader', options, async () => {
	const dom = await render('/');
	assert.match(dom, /id="results"[^>]*aria-live="polite"/);
});
