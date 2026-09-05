// Generates the static examples pages and the sitemap. Run it after changing
// the describer or this list, and commit the output:
//
//     node bin/examples.js
//
// The pages are generated rather than written by hand so their wording can
// never drift from what the interpreter itself says.

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chrome, describe, locales } from '../js/describe/index.js';
import { loadTranslations } from '../js/describe/fallback.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://cron-h.com';
// Also hard-coded in index.html, which is static and cannot import it.
const SPONSOR = 'https://github.com/sponsors/tagadvance';

// Ordered roughly as somebody would search for them: the shortest intervals
// first, then the times of day, then the calendar, then the awkward ones.
export const EXAMPLES = [
	'* * * * *',
	'*/5 * * * *',
	'*/10 * * * *',
	'*/15 * * * *',
	'*/20 * * * *',
	'*/30 * * * *',
	'0 * * * *',
	'30 * * * *',
	'0 */2 * * *',
	'0 */3 * * *',
	'0 */4 * * *',
	'0 */6 * * *',
	'0 */8 * * *',
	'0 */12 * * *',
	'0 9-17 * * *',
	'30 9-17 * * MON-FRI',
	'*/15 */2 * * *',
	'*/15 9-17 * * *',
	'0 0 * * *',
	'0 6 * * *',
	'0 9 * * *',
	'0 12 * * *',
	'0 18 * * *',
	'30 23 * * *',
	'0 0 * * 0',
	'0 3 * * 0',
	'0 9 * * MON-FRI',
	'30 8 * * SAT,SUN',
	'0 22 * * 1-5',
	'0 3 * * 1,3,5',
	'0 0 1 * *',
	'0 0 15 * *',
	'15 14 1 * *',
	'0 0 1 1 *',
	'0 0 1,15 * *',
	'5 0 * 8 *',
	'0 0 13 * FRI',
	'*/7 * * * *',
	'0 */5 * * *',
	'5-59/15 * * * *',
	'@reboot',
	'@hourly',
	'@daily',
	'@weekly',
	'@monthly',
	'@yearly'
];

const escape = (text) =>
	text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const pathFor = (code) => (code === 'en' ? '/examples.html' : `/${code}/examples.html`);

function row(expression, code) {
	const query = new URLSearchParams({ e: expression });
	if (code !== 'en') {
		query.set('lang', code);
	}
	const href = `${code === 'en' ? '' : '../'}index.html?${query}`;
	return `			<tr>
				<td><a href="${escape(href)}"><code>${escape(expression)}</code></a></td>
				<td>${escape(describe(expression, { locale: code }))}</td>
			</tr>`;
}

// Every language lists every other, which is what tells a crawler these pages
// are the same content rather than duplicates competing with each other.
function alternates(code) {
	const links = locales().map(
		({ code: other }) =>
			`	<link rel="alternate" hreflang="${other}" href="${ORIGIN}${pathFor(other)}" />`
	);
	links.push(`	<link rel="alternate" hreflang="x-default" href="${ORIGIN}${pathFor('en')}" />`);
	return links.join('\n');
}

function page(code) {
	const { ui } = chrome(code);
	const home = code === 'en' ? 'index.html' : `../index.html?lang=${code}`;
	const css = code === 'en' ? 'css/template.css' : '../css/template.css';

	return `<!DOCTYPE html>
<html lang="${code}">
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<title>${escape(ui.examplesTitle)} · cron -h</title>

	<meta name="description" content="${escape(ui.examplesIntro)}" />
	<link rel="canonical" href="${ORIGIN}${pathFor(code)}" />
${alternates(code)}

	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="cron -h" />
	<meta property="og:url" content="${ORIGIN}${pathFor(code)}" />
	<meta property="og:title" content="${escape(ui.examplesTitle)}" />
	<meta property="og:description" content="${escape(ui.examplesIntro)}" />
	<meta property="og:image" content="${ORIGIN}/og.png" />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta name="twitter:card" content="summary_large_image" />

	<link rel="stylesheet" type="text/css" href="${css}" />
</head>
<body>
<div id="container">
	<div id="content">
		<h1>cron -h</h1>
		<h3>${escape(ui.examplesTitle)}</h3>
		<hr>
		<div id="interpreter">
			<p>${escape(ui.examplesIntro)}</p>
			<table id="examples-table">
				<thead>
					<tr>
						<th>${escape(ui.columnExpression)}</th>
						<th>${escape(ui.columnMeaning)}</th>
					</tr>
				</thead>
				<tbody>
${EXAMPLES.map((expression) => row(expression, code)).join('\n')}
				</tbody>
			</table>
			<p><a href="${escape(home)}">${escape(ui.backToTool)}</a></p>
		</div>
	</div>
	<div id="footer">
		<a href="https://github.com/tagadvance/cron-h">${escape(ui.source)}</a>
		&middot;
		<a href="${SPONSOR}">${escape(ui.sponsor)}</a>
		&middot;
		Copyright &copy; 2026 Tag Spilman
	</div>
</div>
</body>
</html>
`;
}

function sitemap() {
	const urls = [`${ORIGIN}/`, ...locales().map(({ code }) => `${ORIGIN}${pathFor(code)}`)];
	const entries = urls.map((url) => `	<url><loc>${url}</loc></url>`).join('\n');
	return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`;
}

async function main() {
	// Descriptions no recognizer claims come from cronstrue, so the
	// translations have to be in memory before a single page is written.
	await loadTranslations();

	for (const { code } of locales()) {
		const file = join(ROOT, pathFor(code).slice(1));
		await mkdir(dirname(file), { recursive: true });
		await writeFile(file, page(code));
		console.log(`wrote ${pathFor(code)}`);
	}

	await writeFile(join(ROOT, 'sitemap.xml'), sitemap());
	console.log('wrote /sitemap.xml');
}

// Importable for the tests, runnable from the command line.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
	await main();
}
