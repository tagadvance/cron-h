import cronstrue from '../vendor/cronstrue.js';
import en from './locales/en.js';
import { createFormat } from './format.js';
import { recognize } from './patterns.js';

const LOCALES = { en };
const DEFAULT_LOCALE = 'en';

const formats = new Map();

// en-GB, en-US and plain en all render from the same module, but each keeps its
// own formatter so a British reader still gets a 24 hour clock. A language with
// no module at all falls back completely, words and formats together, rather
// than pairing English wording with Spanish punctuation.
function resolve(tag) {
	const requested = String(tag ?? DEFAULT_LOCALE).trim();
	const language = requested.toLowerCase().split('-')[0];
	return language in LOCALES
		? { locale: LOCALES[language], tag: requested }
		: { locale: LOCALES[DEFAULT_LOCALE], tag: DEFAULT_LOCALE };
}

function formatFor(tag) {
	if (!formats.has(tag)) {
		formats.set(tag, createFormat(tag));
	}
	return formats.get(tag);
}

export function render(descriptor, tag = DEFAULT_LOCALE) {
	const { locale, tag: resolved } = resolve(tag);
	const message = locale.messages[descriptor.id];
	return message ? message(descriptor, formatFor(resolved)) : null;
}

/**
 * Describes an expression in the requested language. Anything the recognizers
 * do not claim falls back to cronstrue, which always has an answer; the
 * fallback is English only until more patterns are recognized.
 *
 * Throws if the expression cannot be parsed at all.
 */
export function describe(expression, { locale = DEFAULT_LOCALE } = {}) {
	const descriptor = recognize(expression);
	if (descriptor !== null) {
		const described = render(descriptor, locale);
		if (described !== null) {
			return described;
		}
	}
	return cronstrue.toString(expression, { verbose: false, throwExceptionOnParseError: true });
}

export { recognize };
