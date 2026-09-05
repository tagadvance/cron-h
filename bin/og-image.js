// Renders the Open Graph card to og.png. Needs a headless Chrome, so it is not
// part of the deploy — run it by hand and commit the result:
//
//     node bin/og-image.js
//
// The example on the card is described by the describer, so the picture cannot
// advertise wording the site does not actually produce.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chrome as strings, describe } from '../js/describe/index.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXPRESSION = '*/15 9-17 * * *';

const BROWSERS = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'];

function browser() {
	for (const candidate of BROWSERS) {
		try {
			execFileSync('which', [candidate], { stdio: 'ignore' });
			return candidate;
		} catch {
			// Try the next one.
		}
	}
	throw new Error(`no headless browser found; tried ${BROWSERS.join(', ')}`);
}

function card() {
	const { ui } = strings('en');
	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
	html, body { margin: 0; padding: 0; }
	body {
		width: 1200px;
		height: 630px;
		background-color: #777777;
		font-family: "Courier New", monospace;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	#card {
		background-color: #FFFFFF;
		border: 2px dotted #000000;
		width: 1080px;
		height: 510px;
		padding: 0 40px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
	}
	h1 { font-size: 92px; margin: 0 0 8px 0; }
	h2 { font-size: 30px; margin: 0 0 48px 0; font-weight: normal; }
	#expression { font-size: 46px; font-weight: bold; margin-bottom: 18px; }
	#meaning { font-size: 34px; color: #CC0000; font-weight: bold; text-align: center; }
	#languages { font-size: 24px; color: #555555; margin-top: 48px; }
</style>
</head>
<body>
	<div id="card">
		<h1>cron -h</h1>
		<h2>${ui.tagline}</h2>
		<div id="expression">${EXPRESSION}</div>
		<div id="meaning">${describe(EXPRESSION, { locale: 'en' })}</div>
		<div id="languages">English · Espa&ntilde;ol · Fran&ccedil;ais · &#26085;&#26412;&#35486; · Portugu&ecirc;s · &#1056;&#1091;&#1089;&#1089;&#1082;&#1080;&#1081; · &#20013;&#25991;</div>
	</div>
</body>
</html>
`;
}

const scratch = mkdtempSync(join(tmpdir(), 'cron-h-og-'));
const source = join(scratch, 'card.html');
writeFileSync(source, card());

const output = join(ROOT, 'og.png');
execFileSync(browser(), [
	'--headless',
	'--disable-gpu',
	'--no-sandbox',
	'--hide-scrollbars',
	'--window-size=1200,630',
	`--screenshot=${output}`,
	`file://${source}`,
]);

console.log(`wrote /og.png from ${source}`);
