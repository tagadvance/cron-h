import { interpretCrontab } from './crontab.js';

const RUN_COUNT = 5;
const LOCALE = navigator.language;

const timestamp = new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeStyle: 'short' });

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

function runsText(runs) {
	if (runs === null) {
		return 'Runs at system startup, so there is no next run to calculate.';
	}
	if (runs.length === 0) {
		return 'Never runs. No date satisfies this expression.';
	}
	return null;
}

function renderEntry(entry) {
	const item = element('li', 'entry');
	item.appendChild(element('code', 'expression', entry.expression));
	item.appendChild(element('p', 'description', entry.description));
	if (entry.command) {
		item.appendChild(element('p', 'command', entry.command));
	}

	const note = runsText(entry.runs);
	if (note) {
		item.appendChild(element('p', 'note', note));
		return item;
	}

	item.appendChild(element('h6', null, `Next ${entry.runs.length} runs`));
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

function render(text, target) {
	const entries = interpretCrontab(text, { count: RUN_COUNT, locale: LOCALE })
		.filter((entry) => entry.kind === 'entry' || entry.kind === 'error');

	target.replaceChildren();
	if (entries.length === 0) {
		target.appendChild(element('li', 'entry note', 'Paste a crontab above to see what it does.'));
		return;
	}
	for (const entry of entries) {
		target.appendChild(entry.kind === 'error' ? renderError(entry) : renderEntry(entry));
	}
}

const crontab = document.getElementById('crontab');
const results = document.getElementById('results');
crontab.addEventListener('input', () => render(crontab.value, results));
render(crontab.value, results);
