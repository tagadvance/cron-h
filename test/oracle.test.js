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
function byDay(dates) {
	const days = new Map();
	for (const date of dates) {
		const day = date.toISOString().slice(0, 10);
		days.set(day, [...(days.get(day) ?? []), date]);
	}
	return [...days.values()];
}

function segment(dates, descriptor) {
	return descriptor.days ? byDay(dates) : [dates];
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

	minuteIntervalInHourRange: (dates, { step, first, last }) => {
		assertEveryGap(byDay(dates), step * MINUTE, 'an even interval inside the window');
		for (const date of dates) {
			assert.ok(date.getUTCHours() >= first.hour && date.getUTCHours() <= last.hour);
			assert.equal(date.getUTCMinutes() % step, first.minute % step);
		}
	},

	monthlyOnDay: (dates, { time, monthDays }) => {
		for (const date of dates) {
			assert.ok(monthDays.includes(date.getUTCDate()), `${date.toISOString()} is not an allowed day`);
			assert.equal(date.getUTCHours(), time.hour);
			assert.equal(date.getUTCMinutes(), time.minute);
		}
	},

	yearlyOnDate: (dates, { time, date: on }) => {
		for (const date of dates) {
			assert.equal(date.getUTCMonth() + 1, on.month);
			assert.equal(date.getUTCDate(), on.day);
			assert.equal(date.getUTCHours(), time.hour);
			assert.equal(date.getUTCMinutes(), time.minute);
		}
	},

	inMonths: (dates, { time, months }) => {
		for (const date of dates) {
			assert.ok(months.includes(date.getUTCMonth() + 1), `${date.toISOString()} is not an allowed month`);
			assert.equal(date.getUTCHours(), time.hour);
			assert.equal(date.getUTCMinutes(), time.minute);
		}
	},

	// The whole point of this descriptor: cron fires when *either* field
	// matches. A run on the 13th need not be a Friday, and a Friday need not be
	// the 13th, so the claim is a disjunction and is asserted as one.
	dayOfMonthOrWeek: (dates, { time, monthDays, days }) => {
		let byDate = 0;
		let byWeekday = 0;
		for (const date of dates) {
			const matchesDate = monthDays.includes(date.getUTCDate());
			const matchesWeekday = days.includes(date.getUTCDay());
			assert.ok(matchesDate || matchesWeekday, `${date.toISOString()} matches neither field`);
			byDate += matchesDate ? 1 : 0;
			byWeekday += matchesWeekday ? 1 : 0;
		}
		// If every run satisfied both, the wording would be describing an AND.
		assert.ok(byDate > 0 && byWeekday > 0, 'both fields should produce runs');
		assert.ok(byDate + byWeekday > dates.length, 'the two sets should overlap only occasionally');
	},

	// A window closes overnight whether or not any day clause is present, so
	// this one always measures within a day.
	hourRange: (dates, { first, last }) => {
		assertEveryGap(byDay(dates), HOUR, 'hourly inside the window');
		for (const date of dates) {
			assert.ok(date.getUTCHours() >= first.hour && date.getUTCHours() <= last.hour);
			assert.equal(date.getUTCMinutes(), first.minute);
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
	'0 9-17 * * *',
	'30 9-17 * * MON-FRI',
	'*/15 9-17 * * *',
	'*/20 8-18 * * MON-FRI',
	'0 0 1 * *',
	'0 0 1,15 * *',
	'15 14 1 * *',
	'0 0 1 1 *',
	'5 0 * 8 *',
	'0 9 * 8 MON',
	'0 0 13 * FRI',
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
		// dayOfMonthOrWeek is exempt: its runs are deliberately not confined to
		// the listed weekdays, and its own checker asserts the disjunction.
		if (descriptor.days && descriptor.id !== 'dayOfMonthOrWeek') {
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
