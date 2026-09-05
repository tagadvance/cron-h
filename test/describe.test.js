import { test } from 'node:test';
import assert from 'node:assert/strict';

import { describe, recognize } from '../js/describe/index.js';

const described = (expression) => describe(expression, { locale: 'en' });

test('the schedules from the original spec', () => {
	assert.equal(described('*/15 * * * *'), 'Every 15 minutes');
	assert.equal(described('*/15 * * * SUN'), 'Every 15 minutes, all day Sunday');
	assert.equal(described('*/15 */2 * * *'), 'Every 15 minutes, on even-numbered hours');
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
		'Every 7 minutes from :00 to :56 of each hour, then again on the hour'
	);
	assert.equal(
		described('0 */5 * * *'),
		'Every 5 hours from 12:00 AM to 8:00 PM each day, then again the next day'
	);
});

test('a stride offset from the start of its field says so', () => {
	assert.equal(described('5-59/15 * * * *'), 'Every 15 minutes, starting at :05');
	assert.equal(described('*/15 1-23/2 * * *'), 'Every 15 minutes, on odd-numbered hours');
});

test('weekday and weekend sets are named, not enumerated', () => {
	assert.equal(described('0 9 * * MON-FRI'), 'Every weekday at 9:00 AM');
	assert.equal(described('30 8 * * SAT,SUN'), 'Every weekend at 8:30 AM');
	assert.equal(described('*/15 * * * 1-5'), 'Every 15 minutes, all day on weekdays');
	assert.equal(described('0 3 * * 1,3,5'), 'Every Monday, Wednesday, and Friday at 3:00 AM');
});

test('the same schedule written two ways reads the same way', () => {
	assert.equal(described('0,15,30,45 * * * *'), described('*/15 * * * *'));
	assert.equal(described('0 0 * * SUN'), described('@weekly'));
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
		'Every 20 minutes from 8:00 AM to 6:40 PM, on weekdays'
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
	for (const nickname of ['@reboot', '@hourly', '@daily', '@midnight', '@weekly', '@monthly', '@yearly']) {
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
