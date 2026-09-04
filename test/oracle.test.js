import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Cron } from '../js/vendor/croner.js';
import { expand } from '../js/nicknames.js';
import { recognize } from '../js/describe/patterns.js';

// Golden tests only prove the output matches the last opinion of it. These
// check something stronger: that the claims a descriptor makes are true of the
// schedule cron will actually run. Because recognizers emit structured
// descriptors rather than sentences, the claims can be checked mechanically and
// in any language.

const FROM = new Date('2026-01-01T00:00:00Z');
const SAMPLE = 200;
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

const runs = (expression) => new Cron(expand(expression), { timezone: 'UTC' }).nextRuns(SAMPLE, FROM);

const gaps = (dates) => dates.slice(1).map((date, index) => date.getTime() - dates[index].getTime());

// A rhythm claim is scoped by whatever day clause the wording carries: "every
// 15 minutes, all day Sunday" promises nothing about the six days in between,
// so gaps are only ever measured within a single day.
function segment(dates, descriptor) {
	if (!descriptor.days) {
		return [dates];
	}
	const byDay = new Map();
	for (const date of dates) {
		const day = date.toISOString().slice(0, 10);
		byDay.set(day, [...(byDay.get(day) ?? []), date]);
	}
	return [...byDay.values()];
}

function assertEveryGap(segments, expected, message) {
	assert.deepEqual([...new Set(segments.flatMap(gaps))], [expected], message);
}

function assertSomeGap(segments, unexpected, message) {
	const observed = segments.flatMap(gaps);
	assert.ok(new Set(observed).size > 1, message);
	assert.ok(observed.some((gap) => gap !== unexpected), message);
}

// One checker per descriptor id, asserting what the wording promises. Value
// claims are checked against every run; rhythm claims against each segment.
const CLAIMS = {
	reboot: () => {},

	everyMinute: (dates, descriptor, segments) => assertEveryGap(segments, MINUTE, 'every minute'),

	minuteInterval: (dates, { step, offset }, segments) => {
		assertEveryGap(segments, step * MINUTE, 'an even interval');
		for (const date of dates) {
			assert.equal(date.getUTCMinutes() % step, offset % step);
		}
	},

	unevenMinuteInterval: (dates, { step, first, last }, segments) => {
		assertSomeGap(segments, step * MINUTE, 'not actually an even interval');
		for (const date of dates) {
			assert.ok(date.getUTCMinutes() >= first && date.getUTCMinutes() <= last);
		}
	},

	minuteIntervalInHours: (dates, { step, hourStep, hourOffset }) => {
		for (const date of dates) {
			assert.equal(date.getUTCMinutes() % step, 0);
			assert.equal(date.getUTCHours() % hourStep, hourOffset % hourStep);
		}
	},

	hourly: (dates, { minute }, segments) => {
		assertEveryGap(segments, HOUR, 'every hour');
		for (const date of dates) {
			assert.equal(date.getUTCMinutes(), minute);
		}
	},

	hourInterval: (dates, { step, time }, segments) => {
		assertEveryGap(segments, step * HOUR, 'an even interval');
		for (const date of dates) {
			assert.equal(date.getUTCMinutes(), time.minute);
			assert.equal(date.getUTCHours() % step, time.hour % step);
		}
	},

	unevenHourInterval: (dates, { step, first, last }, segments) => {
		assertSomeGap(segments, step * HOUR, 'not actually an even interval');
		for (const date of dates) {
			assert.ok(date.getUTCHours() >= first.hour && date.getUTCHours() <= last.hour);
		}
	},

	atTime: (dates, { time }) => {
		for (const date of dates) {
			assert.equal(date.getUTCHours(), time.hour);
			assert.equal(date.getUTCMinutes(), time.minute);
		}
	}
};

const CORPUS = [
	'* * * * *',
	'*/2 * * * *',
	'*/15 * * * *',
	'0,15,30,45 * * * *',
	'5-59/15 * * * *',
	'*/7 * * * *',
	'*/11 * * * *',
	'*/15 */2 * * *',
	'*/15 1-23/2 * * *',
	'*/20 */3 * * *',
	'0 * * * *',
	'30 * * * *',
	'0 */2 * * *',
	'0 */6 * * *',
	'30 */4 * * *',
	'0 */5 * * *',
	'0 */7 * * *',
	'0 3 * * *',
	'0 3 * * 0',
	'0 9 * * MON-FRI',
	'30 8 * * SAT,SUN',
	'*/15 * * * SUN',
	'@daily',
	'@hourly',
	'@weekly',
	'@reboot'
];

for (const expression of CORPUS) {
	test(`${expression} does what it says`, () => {
		const descriptor = recognize(expression);
		assert.notEqual(descriptor, null, 'should be recognized');

		const check = CLAIMS[descriptor.id];
		assert.ok(check, `no oracle for descriptor id "${descriptor.id}"`);

		const dates = descriptor.id === 'reboot' ? [] : runs(expression);
		check(dates, descriptor, segment(dates, descriptor));

		// Whatever days the wording restricts the schedule to, cron must agree.
		if (descriptor.days) {
			for (const date of dates) {
				assert.ok(descriptor.days.includes(date.getUTCDay()), `${date.toISOString()} is not an allowed day`);
			}
		}
	});
}

test('the corpus exercises every descriptor the recognizers can produce', () => {
	const produced = new Set(CORPUS.map((expression) => recognize(expression).id));
	assert.deepEqual([...produced].sort(), Object.keys(CLAIMS).sort());
});
