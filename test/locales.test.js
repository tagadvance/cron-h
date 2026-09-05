import { test } from 'node:test';
import assert from 'node:assert/strict';

import en from '../js/describe/locales/en.js';
import es from '../js/describe/locales/es.js';
import fr from '../js/describe/locales/fr.js';
import ja from '../js/describe/locales/ja.js';
import pt from '../js/describe/locales/pt.js';
import ru from '../js/describe/locales/ru.js';
import zh from '../js/describe/locales/zh.js';
import { describe, chrome, locales } from '../js/describe/index.js';
import { loadTranslations } from '../js/describe/fallback.js';
import { PATTERN_COUNT, recognize } from '../js/describe/patterns.js';

const ALL = [en, es, fr, ja, pt, ru, zh];

// Derived from the recognizers by sweeping a generated matrix, not from a
// hand-written list. A list would have to be maintained alongside the one in
// patterns.js, and the two would drift — which is exactly how a pattern ships
// with no translation in any language.
function sweep() {
	const minutes = ['*', '0', '30', '*/15', '*/7', '5-59/15'];
	const hours = ['*', '0', '9', '*/2', '*/5', '9-17', '1-23/2'];
	const monthDays = ['*', '1', '13', '1,15', '31', '1-31', '*/2'];
	const months = ['*', '1', '8'];
	const weekDays = ['*', '0', 'FRI', 'MON-FRI', '1-7'];

	const ids = new Set(['reboot']);
	for (const minute of minutes) {
		for (const hour of hours) {
			for (const dom of monthDays) {
				for (const month of months) {
					for (const dow of weekDays) {
						const descriptor = recognize(`${minute} ${hour} ${dom} ${month} ${dow}`);
						if (descriptor !== null) {
							ids.add(descriptor.id);
						}
					}
				}
			}
		}
	}
	return [...ids];
}

const IDS = sweep();

// Strings that are genuinely the same word in both languages. Exempting them
// by name keeps the check strict everywhere else, where sameness means the
// translation was never written.
// What each language calls itself. The picker shows these, so "Spanish" where
// "Español" belongs is a real defect, and a non-empty check would not see it.
const ENDONYMS = {
	en: 'English',
	es: 'Español',
	fr: 'Français',
	ja: '日本語',
	pt: 'Português',
	ru: 'Русский',
	zh: '中文',
};

const COINCIDENCES = {
	fr: ['columnExpression'], // "Expression" is spelled the same in French.
};

const SAMPLES = [
	'@reboot',
	'* * * * *',
	'*/15 * * * *',
	'*/7 * * * *',
	'*/15 */2 * * *',
	'30 * * * *',
	'0 */2 * * *',
	'0 9-17 * * *',
	'*/15 9-17 * * *',
	'0 0 1 * *',
	'0 0 1 1 *',
	'5 0 * 8 *',
	'0 0 13 * FRI',
	'0 */5 * * *',
	'0 3 * * 0',
	'*/15 * * * SUN',
	'0 9 * * MON-FRI',
	'30 8 * * SAT,SUN',
];

test('the sweep reaches every recognizer there is', () => {
	assert.equal(IDS.length, PATTERN_COUNT, 'a recognizer exists that nothing here reaches');
});

test('the sample expressions cover every descriptor', () => {
	assert.deepEqual(
		[...new Set(SAMPLES.map((expression) => recognize(expression).id))].sort(),
		[...IDS].sort(),
	);
});

for (const locale of ALL) {
	test(`${locale.code} has a message for every descriptor`, () => {
		assert.deepEqual(Object.keys(locale.messages).sort(), [...IDS].sort());
	});

	test(`${locale.code} has every page string`, () => {
		assert.deepEqual(Object.keys(locale.ui).sort(), Object.keys(en.ui).sort());
	});

	// Having the key is not having the translation. Copying the English
	// template into a locale satisfied the checks above and nothing else.
	if (locale.code !== 'en') {
		test(`${locale.code} actually translates, rather than echoing English`, () => {
			for (const expression of SAMPLES) {
				const translated = describe(expression, { locale: locale.code });
				assert.notEqual(
					translated,
					describe(expression, { locale: 'en' }),
					`${expression} is identical to the English`,
				);
				// Comparing strings is not enough on its own: an English template
				// rendered with a local clock differs from the English string while
				// still being English. No other language has a word "Every".
				assert.doesNotMatch(translated, /\bEvery\b/, `${expression} is still English`);
			}
		});

		test(`${locale.code} actually translates the page strings`, () => {
			for (const [key, value] of Object.entries(locale.ui)) {
				if (typeof value !== 'string' || COINCIDENCES[locale.code]?.includes(key)) {
					continue;
				}
				assert.notEqual(value, en.ui[key], `ui.${key} is identical to the English`);
			}
		});
	}

	test(`${locale.code} produces a non-empty description for every sample`, () => {
		for (const expression of SAMPLES) {
			const described = describe(expression, { locale: locale.code });
			assert.match(described, /\S/, expression);
			// A missed template leaves the parameter names showing.
			assert.doesNotMatch(described, /undefined|\[object|NaN/, expression);
		}
	});

	test(`${locale.code} names itself in its own language`, () => {
		// Pinned, because "non-empty" would have accepted "Spanish" for es.
		assert.equal(locale.name, ENDONYMS[locale.code]);
		assert.equal(locale.fallback.slice(0, 2), locale.code);
	});
}

test('every locale is registered for the picker', () => {
	assert.deepEqual(
		locales()
			.map(({ code }) => code)
			.sort(),
		ALL.map(({ code }) => code).sort(),
	);
	for (const { name } of locales()) {
		assert.match(name, /\S/);
	}
});

test('page strings are rendered by the requested locale', () => {
	assert.equal(chrome('es').ui.language, 'Idioma');
	assert.equal(chrome('zh').ui.language, '语言');
	assert.equal(chrome('xx').ui.language, chrome('en').ui.language);
	assert.equal(chrome('en').ui.nextRuns(5, chrome('en').format), 'Next 5 runs');
});

test('descriptions differ between locales rather than silently falling back', () => {
	const english = describe('0 3 * * 0', { locale: 'en' });
	assert.notEqual(describe('0 3 * * 0', { locale: 'es' }), english);
	assert.notEqual(describe('0 3 * * 0', { locale: 'zh' }), english);
});

test('the fallback is translated once the bundle is loaded', async () => {
	const unrecognized = '*/15 * 1 * *';
	assert.equal(
		recognize(unrecognized),
		null,
		'this test is only meaningful for an unrecognized schedule',
	);

	// Before the bundle arrives every language gets the English fallback.
	assert.equal(describe(unrecognized, { locale: 'es' }), describe(unrecognized, { locale: 'en' }));

	await loadTranslations();
	assert.notEqual(
		describe(unrecognized, { locale: 'es' }),
		describe(unrecognized, { locale: 'en' }),
	);
	assert.notEqual(
		describe(unrecognized, { locale: 'zh' }),
		describe(unrecognized, { locale: 'en' }),
	);
});

// The inflections each language needed. These are the cases that would have
// been unreachable if messages were template strings in a data file.

test('Russian selects all three of its plural forms', () => {
	assert.match(describe('* * * * *', { locale: 'ru' }), /Каждую минуту/);
	assert.match(describe('*/2 * * * *', { locale: 'ru' }), /2 минуты/, 'few');
	assert.match(describe('*/15 * * * *', { locale: 'ru' }), /15 минут/, 'many');
	assert.match(describe('0 */2 * * *', { locale: 'ru' }), /2 часа/, 'few');
	assert.match(describe('0 */6 * * *', { locale: 'ru' }), /6 часов/, 'many');
});

test('Russian names weekdays in the dative, which Intl does not offer', () => {
	assert.match(describe('0 3 * * 0', { locale: 'ru' }), /^По воскресеньям/);
	assert.match(describe('0 3 * * 3', { locale: 'ru' }), /^По средам/);
});

test('Portuguese agrees its article with weekday gender', () => {
	assert.match(describe('0 3 * * 0', { locale: 'pt' }), /^Aos domingos/, 'masculine');
	assert.match(describe('0 3 * * 1', { locale: 'pt' }), /^Às segundas-feiras/, 'feminine');
});

test('Spanish and Portuguese agree their article with the hour', () => {
	assert.match(describe('0 1 * * 0', { locale: 'es' }), /a la 1:00$/);
	assert.match(describe('0 3 * * 0', { locale: 'es' }), /a las 3:00$/);
	assert.match(describe('0 1 * * 0', { locale: 'pt' }), /à 1:00$/);
	assert.match(describe('0 3 * * 0', { locale: 'pt' }), /às 3:00$/);
});

test('French pluralizes weekday names regularly', () => {
	assert.match(describe('0 3 * * 0', { locale: 'fr' }), /^Les dimanches/);
	assert.match(describe('0 3 * * 1,3,5', { locale: 'fr' }), /lundis, mercredis et vendredis/);
});

test('Japanese leads with the day rather than trailing it', () => {
	assert.match(describe('0 3 * * 0', { locale: 'ja' }), /^毎週日曜日/);
	assert.match(describe('0 9 * * MON-FRI', { locale: 'ja' }), /^平日/);
});

test('every published example describes cleanly in every language', async () => {
	const { EXAMPLES } = await import('../bin/examples.js');
	await loadTranslations();

	for (const { code } of locales()) {
		for (const expression of EXAMPLES) {
			const text = describe(expression, { locale: code });
			assert.match(text, /\S/, `${expression} in ${code}`);
			assert.doesNotMatch(text, /undefined|NaN|\[object/, `${expression} in ${code}`);
		}
	}
});

// The audit found the fallback bundle's loaded/not-loaded flag had no coverage
// in either direction: hard-coding it either way passed the whole suite. With
// it stuck on "loaded", a non-English reader silently gets English forever for
// anything no recognizer claims.
test('the fallback reports whether its translations have arrived', async () => {
	const { hasTranslations, loadTranslations } = await import('../js/describe/fallback.js');
	const unrecognized = '*/15 * 1 * *';
	assert.equal(recognize(unrecognized), null, 'this test needs an unrecognized schedule');

	if (!hasTranslations()) {
		assert.equal(
			describe(unrecognized, { locale: 'es' }),
			describe(unrecognized, { locale: 'en' }),
			'before loading, every language gets the English fallback',
		);
	}

	await loadTranslations();
	assert.equal(hasTranslations(), true, 'it must report the bundle as loaded');
	assert.notEqual(
		describe(unrecognized, { locale: 'es' }),
		describe(unrecognized, { locale: 'en' }),
	);
});
