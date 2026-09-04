import { test } from 'node:test';
import assert from 'node:assert/strict';

import en from '../js/describe/locales/en.js';
import es from '../js/describe/locales/es.js';
import zh from '../js/describe/locales/zh.js';
import { describe, chrome, locales } from '../js/describe/index.js';
import { loadTranslations } from '../js/describe/fallback.js';
import { recognize } from '../js/describe/patterns.js';

const ALL = [en, es, zh];

// Every descriptor a recognizer can produce, taken from the corpus the oracle
// already checks, so a new pattern cannot quietly go untranslated.
const IDS = [
	'reboot',
	'everyMinute',
	'minuteInterval',
	'unevenMinuteInterval',
	'minuteIntervalInHours',
	'hourly',
	'hourInterval',
	'unevenHourInterval',
	'atTime'
];

const SAMPLES = [
	'@reboot',
	'* * * * *',
	'*/15 * * * *',
	'*/7 * * * *',
	'*/15 */2 * * *',
	'30 * * * *',
	'0 */2 * * *',
	'0 */5 * * *',
	'0 3 * * 0',
	'*/15 * * * SUN',
	'0 9 * * MON-FRI',
	'30 8 * * SAT,SUN'
];

test('the sample expressions cover every descriptor', () => {
	assert.deepEqual([...new Set(SAMPLES.map((expression) => recognize(expression).id))].sort(), [...IDS].sort());
});

for (const locale of ALL) {
	test(`${locale.code} translates every descriptor`, () => {
		assert.deepEqual(Object.keys(locale.messages).sort(), [...IDS].sort());
	});

	test(`${locale.code} translates every page string`, () => {
		assert.deepEqual(Object.keys(locale.ui).sort(), Object.keys(en.ui).sort());
	});

	test(`${locale.code} produces a non-empty description for every sample`, () => {
		for (const expression of SAMPLES) {
			const described = describe(expression, { locale: locale.code });
			assert.match(described, /\S/, expression);
			// A missed template leaves the parameter names showing.
			assert.doesNotMatch(described, /undefined|\[object|NaN/, expression);
		}
	});

	test(`${locale.code} names itself in its own language`, () => {
		assert.match(locale.name, /\S/);
		assert.equal(locale.fallback.slice(0, 2), locale.code);
	});
}

test('every locale is registered for the picker', () => {
	assert.deepEqual(
		locales().map(({ code }) => code).sort(),
		ALL.map(({ code }) => code).sort()
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
	const unrecognized = '15 14 1 * *';
	assert.equal(recognize(unrecognized), null, 'this test is only meaningful for an unrecognized schedule');

	// Before the bundle arrives every language gets the English fallback.
	assert.equal(describe(unrecognized, { locale: 'es' }), describe(unrecognized, { locale: 'en' }));

	await loadTranslations();
	assert.notEqual(describe(unrecognized, { locale: 'es' }), describe(unrecognized, { locale: 'en' }));
	assert.notEqual(describe(unrecognized, { locale: 'zh' }), describe(unrecognized, { locale: 'en' }));
});
