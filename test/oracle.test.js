import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Cron } from '../js/vendor/croner.js';
import { expand } from '../js/nicknames.js';
import { PATTERN_COUNT, recognize } from '../js/describe/patterns.js';

// Golden tests only prove the output matches the last opinion of it. These
// check something stronger: that the claims a descriptor makes are true of the
// schedule cron will actually run. Because recognizers emit structured
// descriptors rather than sentences, the claims can be checked mechanically and
// in any language.
//
// Every claim is checked in BOTH directions. Asserting only that each run
// satisfies the descriptor lets an over-claim through: saying "on Mondays,
// Wednesdays and Fridays" for a schedule that only ever runs on Mondays would
// pass. So sets are compared for equality, and bounds for exactness.

const FROM = new Date('2026-01-01T00:00:00Z');
const SAMPLE = 200;
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

const runs = (expression) =>
	new Cron(expand(expression), { timezone: 'UTC' }).nextRuns(SAMPLE, FROM);

const gaps = (dates) =>
	dates.slice(1).map((date, index) => date.getTime() - dates[index].getTime());

const sorted = (values) => [...new Set(values)].sort((a, b) => a - b);

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

const segment = (dates, descriptor) => (descriptor.days ? byDay(dates) : [dates]);

// A stride that runs only during certain hours keeps its rhythm within an hour
// and jumps at the edge of it, so that rhythm is measured per hour.
function byHour(dates) {
	const hours = new Map();
	for (const date of dates) {
		const hour = date.toISOString().slice(0, 13);
		hours.set(hour, [...(hours.get(hour) ?? []), date]);
	}
	return [...hours.values()];
}

/** The descriptor names a set; cron must produce that set, no more and no less. */
function assertSameSet(observed, claimed, message) {
	assert.deepEqual(sorted(observed), sorted(claimed), message);
}

function assertEveryGap(segments, expected, message) {
	assert.deepEqual([...new Set(segments.flatMap(gaps))], [expected], message);
}

/**
 * An uneven interval keeps its stride for most of the cycle and then jumps. The
 * stride is the gap that dominates, and there has to be at least one that is
 * not it — otherwise the interval was even and the wording is wrong.
 */
function assertStrideThenWrap(segments, stride, message) {
	const observed = segments.flatMap(gaps);
	const counts = new Map();
	for (const gap of observed) {
		counts.set(gap, (counts.get(gap) ?? 0) + 1);
	}
	const modal = [...counts].sort((a, b) => b[1] - a[1])[0][0];
	assert.equal(modal, stride, `${message}: the dominant gap should be the stride`);
	assert.ok(
		observed.some((gap) => gap !== stride),
		`${message}: an uneven interval must have a gap that is not the stride`,
	);
}

const minutesOf = (dates) => dates.map((date) => date.getUTCMinutes());
const hoursOf = (dates) => dates.map((date) => date.getUTCHours());

/** Earliest and latest time-of-day actually observed, as {hour, minute}. */
function extremes(dates) {
	const asMinutes = dates.map((date) => date.getUTCHours() * 60 + date.getUTCMinutes());
	const low = Math.min(...asMinutes);
	const high = Math.max(...asMinutes);
	return {
		first: { hour: Math.floor(low / 60), minute: low % 60 },
		last: { hour: Math.floor(high / 60), minute: high % 60 },
	};
}

// One checker per descriptor id, asserting what the wording promises.
const CLAIMS = {
	reboot: (dates, descriptor, segments, expression) => {
		// Not time-based, so there is nothing to compare against; what must hold
		// is that it expands to no schedule at all.
		assert.equal(expand(expression), null, '@reboot is not a schedule');
		assert.deepEqual(dates, []);
	},

	everyMinute: (dates, descriptor, segments) => assertEveryGap(segments, MINUTE, 'every minute'),

	minuteInterval: (dates, { step, offset }, segments) => {
		assertEveryGap(segments, step * MINUTE, 'an even interval');
		assert.equal(Math.min(...minutesOf(dates)) % step, offset % step, 'the stated offset');
		for (const date of dates) {
			assert.equal(date.getUTCMinutes() % step, offset % step);
		}
	},

	unevenMinuteInterval: (dates, { step, first, last }, segments) => {
		assertStrideThenWrap(segments, step * MINUTE, 'uneven minute interval');
		assert.equal(Math.min(...minutesOf(dates)), first, 'the first minute of the cycle');
		assert.equal(Math.max(...minutesOf(dates)), last, 'the last minute of the cycle');
	},

	minuteIntervalInHours: (dates, { step, hourStep, hourOffset }) => {
		// Even within each hour it runs; between those hours it necessarily jumps.
		assertEveryGap(byHour(dates), step * MINUTE, 'an even interval within each hour');
		assertSameSet(
			hoursOf(dates),
			Array.from({ length: 24 / hourStep }, (_, i) => hourOffset + i * hourStep),
			'exactly the hours claimed',
		);
		for (const date of dates) {
			assert.equal(date.getUTCMinutes() % step, 0);
		}
	},

	minuteIntervalInHourRange: (dates, { step, first, last }) => {
		assertEveryGap(byDay(dates), step * MINUTE, 'an even interval inside the window');
		const seen = extremes(dates);
		assert.deepEqual(seen.first, first, 'the window opens exactly here');
		assert.deepEqual(seen.last, last, 'and closes exactly here');
	},

	hourly: (dates, { minute }, segments) => {
		assertEveryGap(segments, HOUR, 'every hour');
		for (const date of dates) {
			assert.equal(date.getUTCMinutes(), minute);
		}
	},

	hourInterval: (dates, { step, time }, segments) => {
		assertEveryGap(segments, step * HOUR, 'an even interval');
		assertSameSet(
			hoursOf(dates),
			Array.from({ length: 24 / step }, (_, i) => time.hour + i * step),
			'exactly the hours claimed',
		);
		for (const date of dates) {
			assert.equal(date.getUTCMinutes(), time.minute);
		}
	},

	hourRange: (dates, { first, last }) => {
		assertEveryGap(byDay(dates), HOUR, 'hourly inside the window');
		const seen = extremes(dates);
		assert.deepEqual(seen.first, first, 'the window opens exactly here');
		assert.deepEqual(seen.last, last, 'and closes exactly here');
	},

	unevenHourInterval: (dates, { step, first, last }) => {
		// The wrap is the day boundary itself, so this one is measured across the
		// whole series rather than within a day.
		assertStrideThenWrap([dates], step * HOUR, 'uneven hour interval');
		const seen = extremes(dates);
		assert.deepEqual(seen.first, first, 'the day opens exactly here');
		assert.deepEqual(seen.last, last, 'and closes exactly here');
	},

	monthlyOnDay: (dates, { time, monthDays, everyMonth }) => {
		assertSameSet(
			dates.map((date) => date.getUTCDate()),
			monthDays,
			'exactly the days of the month claimed',
		);
		const months = new Set(dates.map((date) => date.getUTCMonth()));
		assert.equal(months.size === 12, everyMonth, 'everyMonth must match reality');
		for (const date of dates) {
			assert.equal(date.getUTCHours(), time.hour);
			assert.equal(date.getUTCMinutes(), time.minute);
		}
	},

	yearlyOnDate: (dates, { time, date: on, everyYear }) => {
		const years = dates.map((run) => run.getUTCFullYear());
		const consecutive = years.every((year, index) => index === 0 || year === years[index - 1] + 1);
		assert.equal(consecutive, everyYear, 'everyYear must match reality');
		for (const run of dates) {
			assert.equal(run.getUTCMonth() + 1, on.month);
			assert.equal(run.getUTCDate(), on.day);
			assert.equal(run.getUTCHours(), time.hour);
			assert.equal(run.getUTCMinutes(), time.minute);
		}
	},

	inMonths: (dates, { time, months }) => {
		assertSameSet(
			dates.map((date) => date.getUTCMonth() + 1),
			months,
			'exactly the months claimed',
		);
		for (const date of dates) {
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
			assert.equal(date.getUTCHours(), time.hour);
			assert.equal(date.getUTCMinutes(), time.minute);
			byDate += matchesDate ? 1 : 0;
			byWeekday += matchesWeekday ? 1 : 0;
		}
		// If every run satisfied both, the wording would be describing an AND.
		assert.ok(byDate > 0 && byWeekday > 0, 'both fields should produce runs');
		assert.ok(byDate + byWeekday > dates.length, 'the two sets should overlap only occasionally');
	},

	atTime: (dates, { time }) => {
		for (const date of dates) {
			assert.equal(date.getUTCHours(), time.hour);
			assert.equal(date.getUTCMinutes(), time.minute);
		}
	},
};

const CORPUS = [
	'* * * * *',
	'*/2 * * * *',
	'*/15 * * * *',
	'0,15,30,45 * * * *',
	'5-59/15 * * * *',
	'*/7 * * * *',
	'*/11 * * * *',
	'5-59/7 * * * *',
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
	'30 */5 * * *',
	'0 9-17 * * *',
	'30 9-17 * * MON-FRI',
	'*/15 9-17 * * *',
	'*/20 8-18 * * MON-FRI',
	'0 3 * * *',
	'0 3 * * 0',
	'0 9 * * MON-FRI',
	'30 8 * * SAT,SUN',
	'*/15 * * * SUN',
	'0 0 1 * *',
	'0 0 1,15 * *',
	'0 0 31 * *',
	'15 14 1 * *',
	'0 0 1 1 *',
	'0 0 29 2 *',
	'5 0 * 8 *',
	'0 9 * 8 MON',
	'0 0 13 * FRI',
	// Written-out full day fields, which cron reads as restrictions and
	// combines with OR. These describe wrongly if isFull is used in place of
	// isStar.
	'0 0 13 * 1-7',
	'30 8 1-31 * MON-FRI',
	'0 0 1-31 8 FRI',
	'@daily',
	'@hourly',
	'@weekly',
	'@monthly',
	'@yearly',
	'@reboot',
];

for (const expression of CORPUS) {
	test(`${expression} does what it says`, () => {
		const descriptor = recognize(expression);
		assert.notEqual(descriptor, null, 'should be recognized');

		const check = CLAIMS[descriptor.id];
		assert.ok(check, `no oracle for descriptor id "${descriptor.id}"`);

		const dates = descriptor.id === 'reboot' ? [] : runs(expression);
		check(dates, descriptor, segment(dates, descriptor), expression);

		// Whatever days the wording restricts the schedule to, cron must run on
		// all of them and on no others. dayOfMonthOrWeek is exempt: its runs are
		// deliberately not confined to the listed weekdays, and its own checker
		// asserts the disjunction.
		if (descriptor.days && descriptor.id !== 'dayOfMonthOrWeek') {
			assertSameSet(
				dates.map((date) => date.getUTCDay()),
				descriptor.days,
				'exactly the weekdays claimed',
			);
		}
	});
}

// Generates a broad matrix rather than a hand-written list, so a recognizer
// added without a corpus entry still gets found.
function sweep() {
	const minutes = ['*', '0', '30', '*/15', '*/7', '5-59/15', '0,15,30,45'];
	const hours = ['*', '0', '9', '*/2', '*/5', '9-17', '1-23/2'];
	const monthDays = ['*', '1', '13', '1,15', '31', '1-31', '*/2'];
	const months = ['*', '1', '8', '1,7'];
	const weekDays = ['*', '0', 'FRI', 'MON-FRI', '1-7', '0,6'];

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
	return ids;
}

test('every pattern the recognizers can produce has an oracle', () => {
	const produced = sweep();

	// Derived from the recognizers themselves, not from a second hand-written
	// list that could drift alongside the first.
	assert.equal(
		produced.size,
		PATTERN_COUNT,
		'a recognizer exists that this sweep never reaches, so nothing tests it',
	);
	for (const id of produced) {
		assert.ok(CLAIMS[id], `descriptor "${id}" has no oracle`);
	}
});

test('the corpus reaches every pattern too', () => {
	const covered = new Set(CORPUS.map((expression) => recognize(expression).id));
	assert.deepEqual([...covered].sort(), [...sweep()].sort());
});
