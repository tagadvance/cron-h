import { test } from 'node:test';
import assert from 'node:assert/strict';

import { describe, recognize } from '../js/describe/index.js';

const described = (expression) => describe(expression, { locale: 'en' });

test('the schedules from the original spec', () => {
	assert.equal(described('*/15 * * * *'), 'Every 15 minutes');
	assert.equal(described('*/15 * * * SUN'), 'Every 15 minutes, all day Sunday');
	assert.equal(described('*/15 */2 * * *'), 'Every 15 minutes, during even-numbered hours');
	assert.equal(described('0 3 * * 0'), 'Every Sunday at 3:00 AM');
	assert.equal(described('0 */2 * * *'), 'Every 2 hours');
	assert.equal(described('0 */6 * * *'), 'Every 6 hours');
});

test('every nickname', () => {
	assert.equal(described('@reboot'), 'Once at system startup');
	assert.equal(described('@daily'), 'Every day at 12:00 AM');
	assert.equal(described('@midnight'), 'Every day at 12:00 AM');
	assert.equal(described('@hourly'), 'Every hour, on the hour');
	assert.equal(described('@weekly'), 'Every Sunday at 12:00 AM');
});

test('a stride that does not divide its field evenly says so', () => {
	assert.equal(
		described('*/7 * * * *'),
		'Every 7 minutes from :00 to :56 of each hour, then again at :00 of the next',
	);
	assert.equal(
		described('0 */5 * * *'),
		'Every 5 hours from 12:00 AM to 8:00 PM each day, then again the next day',
	);
});

test('a stride offset from the start of its field says so', () => {
	assert.equal(described('5-59/15 * * * *'), 'Every 15 minutes, starting at :05');
	assert.equal(described('*/15 1-23/2 * * *'), 'Every 15 minutes, during odd-numbered hours');
});

test('weekday and weekend sets are named, not enumerated', () => {
	assert.equal(described('0 9 * * MON-FRI'), 'Every weekday at 9:00 AM');
	assert.equal(described('30 8 * * SAT,SUN'), 'Every weekend at 8:30 AM');
	assert.equal(described('*/15 * * * 1-5'), 'Every 15 minutes, all day on weekdays');
	assert.equal(described('0 3 * * 1,3,5'), 'Every Monday, Wednesday, and Friday at 3:00 AM');
});

test('the same schedule written two ways reads the same way', () => {
	assert.equal(described('0,15,30,45 * * * *'), described('*/15 * * * *'));
	assert.equal(described('0,15,30,45 * * * *'), 'Every 15 minutes', 'and it is this');
	assert.equal(described('0 0 * * SUN'), described('@weekly'));
	assert.equal(described('0 0 * * SUN'), 'Every Sunday at 12:00 AM', 'and it is this');
});

test('unrecognized schedules fall back rather than fail', () => {
	// A minute stride pinned to a day of the month: cron accepts it, no
	// recognizer claims it, and cronstrue still has an answer.
	assert.equal(recognize('*/15 * 1 * *'), null);
	assert.match(described('*/15 * 1 * *'), /\S/);
	assert.match(described('0 0 L * *'), /\S/);
});

test('an unparseable expression still throws', () => {
	assert.throws(() => described('* * * * bogus'));
	assert.throws(() => described('nonsense'));
});

test('an unknown locale falls back to English rather than failing', () => {
	assert.equal(describe('*/15 * * * *', { locale: 'xx' }), 'Every 15 minutes');
	assert.equal(describe('*/15 * * * *', { locale: 'en-GB' }), 'Every 15 minutes');
});

test('a plain hour range is a range, not an uneven interval', () => {
	assert.equal(described('0 9-17 * * *'), 'Every hour from 9:00 AM to 5:00 PM');
	assert.equal(described('30 9-17 * * MON-FRI'), 'Every hour from 9:30 AM to 5:30 PM, on weekdays');
});

test('a windowed schedule is not described as running all day', () => {
	assert.doesNotMatch(described('0 9-17 * * MON-FRI'), /all day/);
	assert.match(described('*/15 * * * SUN'), /all day/);
});

test('a stride inside a window ends at the last firing, not on the hour', () => {
	assert.equal(described('*/15 9-17 * * *'), 'Every 15 minutes from 9:00 AM to 5:45 PM');
	assert.equal(
		described('*/20 8-18 * * MON-FRI'),
		'Every 20 minutes from 8:00 AM to 6:40 PM, on weekdays',
	);
});

test('calendar schedules are described by the calendar', () => {
	assert.equal(described('0 0 1 * *'), 'Every month on the 1st at 12:00 AM');
	assert.equal(described('0 0 1,15 * *'), 'Every month on the 1st and 15th at 12:00 AM');
	assert.equal(described('0 0 2 * *'), 'Every month on the 2nd at 12:00 AM');
	assert.equal(described('0 0 23 * *'), 'Every month on the 23rd at 12:00 AM');
	assert.equal(described('0 0 1 1 *'), 'Every year on January 1 at 12:00 AM');
	assert.equal(described('5 0 * 8 *'), 'Every day in August at 12:05 AM');
	assert.equal(described('0 9 * 8 MON'), 'Every Monday in August at 9:00 AM');
});

test('every nickname is now recognized rather than falling back', () => {
	for (const nickname of [
		'@reboot',
		'@hourly',
		'@daily',
		'@midnight',
		'@weekly',
		'@monthly',
		'@yearly',
	]) {
		assert.notEqual(recognize(nickname), null, nickname);
	}
});

// The single most misunderstood thing about cron: these are alternatives, not
// a combination. "Friday the 13th" is what people read; it is not what runs.
test('a restricted day of month AND day of week says so, loudly', () => {
	const described13 = described('0 0 13 * FRI');
	assert.match(described13, /13th/);
	assert.match(described13, /Friday/);
	assert.match(described13, /and also/);
	assert.match(described13, /either/);
});

// Cron combines the two day fields with OR unless the field is a star. The
// test is syntactic: 1-31 matches every day and is still a restriction, so
// these all run every day rather than on the day the fields name.
test('a written-out full day field is a restriction, not a wildcard', () => {
	assert.equal(described('0 0 13 * 1-7'), 'Every day at 12:00 AM');
	assert.equal(described('0 0 13 * 0-6'), 'Every day at 12:00 AM');
	assert.equal(described('30 8 1-31 * MON-FRI'), 'Every day at 8:30 AM');
	assert.equal(described('0 0 1-31 8 FRI'), 'Every day in August at 12:00 AM');

	// The star forms of the same schedules, which do mean what they look like.
	assert.equal(described('0 0 13 * *'), 'Every month on the 13th at 12:00 AM');
	assert.equal(described('30 8 * * MON-FRI'), 'Every weekday at 8:30 AM');
});

test('a date that cannot occur is never described as one that can', () => {
	// Date.UTC rolls 31 April into 1 May, so this used to read "Every year on
	// May 1" directly above "Never runs."
	for (const expression of ['0 0 31 4 *', '0 0 30 2 *', '0 0 31 2 *', '0 0 31 6 *']) {
		assert.equal(recognize(expression), null, expression);
		assert.doesNotMatch(described(expression), /May|March|July/, expression);
	}
	// February 29 does come round, so it stays.
	assert.equal(described('0 0 29 2 *'), 'Every leap year on February 29 at 12:00 AM');
});

test('a day that skips short months does not claim every month', () => {
	assert.equal(described('0 0 31 * *'), 'On the 31st of every month that has one, at 12:00 AM');
	assert.equal(described('0 0 28 * *'), 'Every month on the 28th at 12:00 AM');
});

test('an interval that does not restart on the hour does not say it does', () => {
	assert.equal(
		described('5-59/7 * * * *'),
		'Every 7 minutes from :05 to :54 of each hour, then again at :05 of the next',
	);
});

test('a bare value with a step runs to the end of its field', () => {
	assert.equal(described('5/10 * * * *'), 'Every 10 minutes, starting at :05');
	// Not "every minute": it skips :00 and :01.
	assert.equal(
		described('2/1 * * * *'),
		'Every minute from :02 to :59 of each hour, then again at :02 of the next',
	);
});

test('Sunday can be written as 7', () => {
	assert.equal(described('0 3 * * 7'), described('0 3 * * 0'));
	assert.equal(described('0 3 * * 5-7'), 'Every Sunday, Friday, and Saturday at 3:00 AM');
});

test('@annually is @yearly', () => {
	assert.equal(described('@annually'), described('@yearly'));
	assert.equal(described('@annually'), 'Every year on January 1 at 12:00 AM');
	// Padding is tolerated on a nickname.
	assert.equal(described('  @daily  '), 'Every day at 12:00 AM');
});

test('an inherited property of the nickname table is not a nickname', () => {
	// `in` walks the prototype chain; these used to expand to a function and an
	// object, and describe() threw.
	for (const name of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
		assert.throws(() => described(name), name);
	}
});

test('a region keeps its own clock', () => {
	assert.equal(describe('0 15 * * *', { locale: 'en' }), 'Every day at 3:00 PM');
	assert.equal(describe('0 15 * * *', { locale: 'en-GB' }), 'Every day at 15:00');
});

test('an unparseable expression still throws', () => {
	assert.throws(() => described('* * * * bogus'));
});

test('a field one value short of full is not full', () => {
	// Relaxing isFull by one passed the whole suite, and turned these into
	// "Every minute" and "Every day".
	assert.equal(
		described('0-58 * * * *'),
		'Every minute from :00 to :58 of each hour, then again at :00 of the next',
	);
	// 1-30 is not every day of the month, so this must not collapse to one.
	assert.notEqual(described('0 0 1-30 * *'), 'Every day at 12:00 AM');
	assert.match(described('0 0 1-30 * *'), /30th/);
	assert.equal(described('0 0 1-31 * *'), 'Every day at 12:00 AM', 'but 1-31 is');
});
