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
	'.txt': 'text/plain'
};

function browser() {
	for (const candidate of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
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

const server = createServer(async (request, response) => {
	const path = normalize(decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
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
			`${origin}${path}`
		],
		{ encoding: 'utf8', timeout: 60000, maxBuffer: 32 * 1024 * 1024 }
	);
	return stdout;
}

const descriptions = (dom) => [...dom.matchAll(/<p class="description">([^<]*)</g)].map((m) => m[1]);

test('the sample crontab is explained on load', options, async () => {
	const dom = await render('/');
	assert.deepEqual(descriptions(dom), [
		'Every 15 minutes',
		'Every Sunday at 3:00 AM',
		'Every day at 12:00 AM',
		'Once at system startup'
	]);
	assert.match(dom, /Next 5 runs/);
});

test('a shared link fills in its schedule and titles the page after it', options, async () => {
	const dom = await render('/index.html?e=0+9-17+*+*+MON-FRI');
	assert.deepEqual(descriptions(dom), ['Every hour from 9:00 AM to 5:00 PM, on weekdays']);
	assert.match(dom, /<title>0 9-17 \* \* MON-FRI — Every hour from 9:00 AM to 5:00 PM, on weekdays · cron -h/);
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

test('the page a crawler sees carries its card and canonical', options, async () => {
	const dom = await render('/');
	assert.match(dom, /<meta property="og:image" content="https:\/\/cron-h\.com\/og\.png"/);
	assert.match(dom, /<link rel="canonical" href="https:\/\/cron-h\.com\/"/);
	assert.match(dom, /name="twitter:card" content="summary_large_image"/);
});
