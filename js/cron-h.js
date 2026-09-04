import { interpretCrontab } from './crontab.js';
import { chrome, locales } from './describe/index.js';
import { hasTranslations, loadTranslations } from './describe/fallback.js';

const RUN_COUNT = 5;
const STORED_LOCALE = 'cron-h.locale';

function element(tag, className, text) {
	const node = document.createElement(tag);
	if (className) {
		node.className = className;
	}
	if (text !== undefined) {
		node.textContent = text;
	}
	return node;
}

function runsText(runs, ui) {
	if (runs === null) {
		return ui.atStartup;
	}
	if (runs.length === 0) {
		return ui.never;
	}
	return null;
}

function renderEntry(entry, { ui, format }, timestamp) {
	const item = element('li', 'entry');
	item.appendChild(element('code', 'expression', entry.expression));
	item.appendChild(element('p', 'description', entry.description));
	if (entry.command) {
		item.appendChild(element('p', 'command', entry.command));
	}

	const note = runsText(entry.runs, ui);
	if (note) {
		item.appendChild(element('p', 'note', note));
		return item;
	}

	item.appendChild(element('h6', null, ui.nextRuns(entry.runs.length, format)));
	const list = element('ol', 'runs');
	for (const run of entry.runs) {
		list.appendChild(element('li', null, timestamp.format(run)));
	}
	item.appendChild(list);
	return item;
}

function renderError(entry) {
	const item = element('li', 'entry error');
	item.appendChild(element('code', 'expression', entry.line.trim()));
	item.appendChild(element('p', 'description', entry.message));
	return item;
}

function render(text, target, locale) {
	const strings = chrome(locale);
	const timestamp = new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeStyle: 'short' });
	const entries = interpretCrontab(text, { count: RUN_COUNT, locale })
		.filter((entry) => entry.kind === 'entry' || entry.kind === 'error');

	target.replaceChildren();
	if (entries.length === 0) {
		target.appendChild(element('li', 'entry note', strings.ui.empty));
		return;
	}
	for (const entry of entries) {
		target.appendChild(entry.kind === 'error' ? renderError(entry) : renderEntry(entry, strings, timestamp));
	}
}

// The page's own wording is translated from the same locale modules as the
// schedules, so a Chinese reader does not get Chinese descriptions wrapped in
// English furniture.
const CHROME = {
	tagline: 'tagline',
	'instructions-heading': 'instructions',
	step1: 'step1',
	step2: 'step2',
	'language-label': 'language',
	disclaimer: 'privacy',
	source: 'source'
};

function renderChrome(locale) {
	const { ui } = chrome(locale);
	for (const [id, key] of Object.entries(CHROME)) {
		document.getElementById(id).textContent = ui[key];
	}
}

const crontab = document.getElementById('crontab');
const results = document.getElementById('results');
const language = document.getElementById('language');

const spoken = new Set(locales().map(({ code }) => code));
const base = (tag) => String(tag ?? '').toLowerCase().split('-')[0];
const supported = (tag) => spoken.has(base(tag));

// A remembered choice wins over the browser's, and browser storage is not
// always readable.
function remembered() {
	try {
		return localStorage.getItem(STORED_LOCALE);
	} catch {
		return null;
	}
}

function remember(locale) {
	try {
		localStorage.setItem(STORED_LOCALE, locale);
	} catch {
		// A reader who blocks storage picks their language again next visit.
	}
}

let locale = base([remembered(), ...navigator.languages, navigator.language].find(supported) ?? 'en');

for (const { code, name } of locales()) {
	const option = element('option', null, name);
	option.value = code;
	language.appendChild(option);
}
language.value = locale;

function update() {
	document.documentElement.lang = locale;
	renderChrome(locale);
	render(crontab.value, results, locale);

	// Schedules no recognizer claims are described by a translation bundle an
	// order of magnitude larger than the rest of the page, so it is fetched
	// only once somebody reads in another language, and the page redrawn when
	// it lands.
	if (locale !== 'en' && !hasTranslations()) {
		loadTranslations().then(() => render(crontab.value, results, locale));
	}
}

crontab.addEventListener('input', update);
language.addEventListener('change', () => {
	locale = language.value;
	remember(locale);
	update();
});
update();
