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
import { recognize } from '../js/describe/patterns.js';

const ALL = [en, es, fr, ja, pt, ru, zh];

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
	'hourRange',
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
	'0 9-17 * * *',
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
