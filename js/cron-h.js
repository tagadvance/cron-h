import { interpretCrontab } from './crontab.js';
import { chrome, locales } from './describe/index.js';
import { hasTranslations, loadTranslations } from './describe/fallback.js';

const RUN_COUNT = 5;
const STORED_LOCALE = 'cron-h.locale';
const SITE = 'cron -h';

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

	item.appendChild(element('h4', null, ui.nextRuns(entry.runs.length, format)));
	const list = element('ol', 'runs');
	for (const run of entry.runs) {
		list.appendChild(element('li', null, timestamp.format(run)));
	}
	item.appendChild(list);
	return item;
}

function renderError(entry, { ui }) {
	const item = element('li', 'entry error');
	item.appendChild(element('code', 'expression', entry.expression ?? entry.line.trim()));
	item.appendChild(element('p', 'description', ui[entry.reason]));
	if (entry.command) {
		item.appendChild(element('p', 'command', entry.command));
	}
	return item;
}

function render(text, target, locale) {
	const strings = chrome(locale);
	const timestamp = new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeStyle: 'short' });
	const entries = interpretCrontab(text, { count: RUN_COUNT, locale }).filter(
		(entry) => entry.kind === 'entry' || entry.kind === 'error',
	);

	retitle(entries, strings);
	lastEntries = entries;
	scheduleUrlUpdate();

	target.replaceChildren();
	if (entries.length === 0) {
		target.appendChild(element('li', 'entry note', strings.ui.empty));
		return;
	}
	for (const entry of entries) {
		target.appendChild(
			entry.kind === 'error' ? renderError(entry, strings) : renderEntry(entry, strings, timestamp),
		);
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
	examples: 'examples',
	source: 'source',
	sponsor: 'sponsor',
};

const description = document.querySelector('meta[name="description"]');

let lastEntries = [];

// A page showing exactly one schedule is worth a title and description of its
// own: it is what a shared link previews as, and what a crawler reads. Open
// Graph tags stay static, because the crawlers that read them do not run
// JavaScript.
function retitle(entries, strings) {
	const only = entries.length === 1 && entries[0].kind === 'entry' ? entries[0] : null;
	document.title = only ? `${only.expression} — ${only.description} · ${SITE}` : SITE;
	description.content = only ? `${only.expression} — ${only.description}` : strings.ui.tagline;
}

// One schedule can be shared as a link; a whole crontab cannot, and should not
// end up in somebody's browser history either.
//
// Anything else already in the URL is left alone. Rebuilding the query from
// scratch dropped the fragment and every other parameter, and clearing `e` for
// input that is not exactly one schedule meant a reload threw the reader's
// work away.
function reflect(entries, locale) {
	const only = entries.length === 1 && entries[0].kind === 'entry' ? entries[0] : null;
	const url = new URL(location.href);

	if (only) {
		url.searchParams.set('e', only.expression);
	}
	if (locale === 'en') {
		url.searchParams.delete('lang');
	} else {
		url.searchParams.set('lang', locale);
	}

	if (url.href !== location.href) {
		history.replaceState(null, '', url);
	}
}

function renderChrome(locale) {
	const { ui } = chrome(locale);
	for (const [id, key] of Object.entries(CHROME)) {
		document.getElementById(id).textContent = ui[key];
	}
	document.getElementById('examples').href =
		locale === 'en' ? 'examples.html' : `${locale}/examples.html`;
}

const crontab = document.getElementById('crontab');
const results = document.getElementById('results');
const language = document.getElementById('language');

const spoken = new Set(locales().map(({ code }) => code));
const base = (tag) =>
	String(tag ?? '')
		.toLowerCase()
		.split('-')[0];
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

// A shared link carries its own language and schedule; both win over anything
// this browser remembers.
const shared = new URLSearchParams(location.search);
if (shared.get('e')) {
	crontab.value = shared.get('e');
}

let locale = base(
	[shared.get('lang'), remembered(), ...navigator.languages, navigator.language].find(supported) ??
		'en',
);

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

// Browsers rate-limit history updates, and Chrome warns at a few hundred. The
// rendering is cheap enough to run per keystroke; only the URL waits.
let pendingUrl = null;
function scheduleUrlUpdate() {
	clearTimeout(pendingUrl);
	pendingUrl = setTimeout(() => reflect(lastEntries, locale), 250);
}

crontab.addEventListener('input', update);
language.addEventListener('change', () => {
	locale = language.value;
	remember(locale);
	update();
});
update();
