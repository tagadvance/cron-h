import en from './locales/en.js';
import es from './locales/es.js';
import fr from './locales/fr.js';
import ja from './locales/ja.js';
import pt from './locales/pt.js';
import ru from './locales/ru.js';
import zh from './locales/zh.js';
import { createFormat } from './format.js';
import { translate } from './fallback.js';
import { recognize } from './patterns.js';

const LOCALES = { en, es, fr, ja, pt, ru, zh };
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
		formats.set(tag, create(tag));
	}
	return formats.get(tag);
}

// Only the language subtag is checked against the locales we have, so a tag
// like "en-" or "fr-1" gets this far and then throws inside Intl. A malformed
// region is not worth an exception; drop to the bare language.
function create(tag) {
	try {
		return createFormat(tag);
	} catch {
		return createFormat(tag.toLowerCase().split('-')[0]);
	}
}

export function render(descriptor, tag = DEFAULT_LOCALE) {
	const { locale, tag: resolved } = resolve(tag);
	const message = locale.messages[descriptor.id];
	return message ? message(descriptor, formatFor(resolved)) : null;
}

/**
 * Describes an expression in the requested language. Anything the recognizers
 * do not claim falls back to cronstrue, which always has an answer. Until
 * loadTranslations() has resolved that answer is in English whatever the
 * requested language.
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
	return translate(expression, resolve(locale).locale.fallback);
}

/** The page's own strings in the requested language, and the formatter to build them with. */
export function chrome(tag = DEFAULT_LOCALE) {
	const { locale, tag: resolved } = resolve(tag);
	return { ui: locale.ui, format: formatFor(resolved) };
}

/** The languages the describer speaks, for a picker. */
export const locales = () => Object.values(LOCALES).map(({ code, name }) => ({ code, name }));

export { recognize };
