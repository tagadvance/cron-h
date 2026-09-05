import { parseExpression } from './fields.js';

// The most days each month can hold. February keeps 29 because that date does
// occur, just not every year.
const LONGEST = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
import { expand, isNickname } from '../nicknames.js';

// Recognizers describe the shape of a schedule rather than its fields, and
// return a language-free descriptor: a message id plus typed parameters. The
// English never exists until a locale renders it, which is what makes multiple
// languages possible and lets the tests assert on meaning instead of wording.

// How cron will combine the two day fields for this expression.
//
// The rule is syntactic, not numeric: cron switches from AND to OR unless a day
// field is a star. `1-31` matches every day of the month yet still counts as a
// restriction, so `30 8 1-31 * MON-FRI` runs every day rather than on weekdays.
//
// Two definitions of "is a star" exist in the wild. Vixie's implementation
// tests whether the field *begins* with `*`, making `*/2` a star; `man 5
// crontab` says the fields must "not be `*`", making it a restriction. croner
// implements the documented rule, and croner computes the run times shown
// beside every sentence, so we follow it — a description that contradicted the
// list underneath it would be worse than either reading.
export function dayModel({ dayOfMonth, dayOfWeek }) {
	if (!dayOfMonth.isStar && !dayOfWeek.isStar) {
		// Cron runs the job when either field matches. If either one already
		// matches every day, their union does too, and no day is excluded.
		if (dayOfMonth.isFull || dayOfWeek.isFull) {
			return { kind: 'none', weekDays: null };
		}
		return { kind: 'either', weekDays: dayOfWeek.values };
	}

	// A star on either side means both must match.
	if (!dayOfMonth.isFull && !dayOfWeek.isFull) {
		// Both narrow the days, e.g. `*/2` days of the month that are Mondays.
		// No recognizer words that; let it fall back.
		return { kind: 'both', weekDays: null };
	}
	if (!dayOfMonth.isFull) {
		return { kind: 'monthDay', weekDays: null };
	}
	return { kind: 'none', weekDays: dayOfWeek.isFull ? null : dayOfWeek.values };
}

// Every recognizer is tried in order; the first to return a descriptor wins.
// Anything not claimed here falls through to the general purpose describer, so
// the list can grow one honest pattern at a time.
const RECOGNIZERS = [
	// * * * * *
	function everyMinute({ minute, hour, weekDays }) {
		if (!minute.isFull || !hour.isFull) {
			return null;
		}
		return { id: 'everyMinute', days: weekDays };
	},

	// */15 * * * *
	function minuteInterval({ minute, hour, weekDays }) {
		if (!minute.isEvenCycle || !hour.isFull) {
			return null;
		}
		return {
			id: 'minuteInterval',
			step: minute.stride,
			offset: minute.first,
			days: weekDays,
		};
	},

	// */7 * * * *, which fires at :00 through :56 and then again 4 minutes
	// later. Every other tool calls this "every 7 minutes"; it is not.
	function unevenMinuteInterval({ minute, hour, weekDays }) {
		if (minute.stride === null || minute.isEvenCycle || !hour.isFull) {
			return null;
		}
		return {
			id: 'unevenMinuteInterval',
			step: minute.stride,
			first: minute.first,
			last: minute.last,
			days: weekDays,
		};
	},

	// */15 */2 * * *
	function minuteIntervalInHours({ minute, hour, weekDays }) {
		if (!minute.isEvenCycle || minute.first !== 0 || !hour.isEvenCycle || hour.first > 1) {
			return null;
		}
		return {
			id: 'minuteIntervalInHours',
			step: minute.stride,
			hourStep: hour.stride,
			hourOffset: hour.first,
			days: weekDays,
		};
	},

	// 30 * * * *
	function hourly({ minute, hour, weekDays }) {
		if (!minute.isSingleton || !hour.isFull) {
			return null;
		}
		return { id: 'hourly', minute: minute.first, days: weekDays };
	},

	// 0 */2 * * *
	function hourInterval({ minute, hour, weekDays }) {
		if (!minute.isSingleton || !hour.isEvenCycle) {
			return null;
		}
		return {
			id: 'hourInterval',
			step: hour.stride,
			time: { hour: hour.first, minute: minute.first },
			days: weekDays,
		};
	},

	// */15 9-17 * * *, a stride inside a window. The last firing is at :45 of
	// the final hour, not on the hour, which the wording has to reflect.
	function minuteIntervalInHourRange({ minute, hour, weekDays }) {
		if (!minute.isEvenCycle || hour.stride !== 1 || hour.isFull) {
			return null;
		}
		return {
			id: 'minuteIntervalInHourRange',
			step: minute.stride,
			first: { hour: hour.first, minute: minute.first },
			last: { hour: hour.last, minute: minute.last },
			days: weekDays,
		};
	},

	// 0 9-17 * * *, the business hours schedule. A stride of one is a plain
	// range and reads as one; without this it would be described as an uneven
	// interval of "every 1 hour".
	function hourRange({ minute, hour, weekDays }) {
		if (!minute.isSingleton || hour.stride !== 1 || hour.isFull) {
			return null;
		}
		return {
			id: 'hourRange',
			first: { hour: hour.first, minute: minute.first },
			last: { hour: hour.last, minute: minute.first },
			days: weekDays,
		};
	},

	// 0 */5 * * *, which runs out of day before the stride comes round again.
	function unevenHourInterval({ minute, hour, weekDays }) {
		if (!minute.isSingleton || hour.stride === null || hour.isEvenCycle) {
			return null;
		}
		return {
			id: 'unevenHourInterval',
			step: hour.stride,
			first: { hour: hour.first, minute: minute.first },
			last: { hour: hour.last, minute: minute.first },
			days: weekDays,
		};
	},

	// 0 3 * * 0
	function atTime({ minute, hour, weekDays }) {
		if (!minute.isSingleton || !hour.isSingleton) {
			return null;
		}
		return {
			id: 'atTime',
			time: { hour: hour.first, minute: minute.first },
			days: weekDays,
		};
	},
];

// Schedules that turn on the calendar rather than the clock. These are tried
// only when the day of the month or the month itself is restricted, which is
// exactly when the recognizers above decline.
const CALENDAR = [
	// 0 0 13 * FRI. Cron fires when *either* field matches, which is the most
	// misunderstood thing about it, so it gets wording of its own rather than a
	// clause bolted onto something else. Reached only when dayModel() says the
	// two fields are combined with OR and both genuinely narrow the days.
	function dayOfMonthOrWeek({ minute, hour, dayOfMonth, month, dayOfWeek, day }) {
		if (!minute.isSingleton || !hour.isSingleton || !month.isFull || day.kind !== 'either') {
			return null;
		}
		return {
			id: 'dayOfMonthOrWeek',
			time: { hour: hour.first, minute: minute.first },
			monthDays: dayOfMonth.values,
			days: dayOfWeek.values,
		};
	},

	// 0 0 1 1 *, one date a year.
	function yearlyOnDate({ minute, hour, dayOfMonth, month, day }) {
		if (!minute.isSingleton || !hour.isSingleton || day.kind !== 'monthDay') {
			return null;
		}
		if (!dayOfMonth.isSingleton || !month.isSingleton) {
			return null;
		}
		// A date that does not exist never fires, and rendering it would invent
		// a different one: Date.UTC rolls 31 April forward to 1 May. February
		// stays in because the 29th does come round, just not every year.
		if (dayOfMonth.first > LONGEST[month.first - 1]) {
			return null;
		}
		return {
			id: 'yearlyOnDate',
			time: { hour: hour.first, minute: minute.first },
			date: { month: month.first, day: dayOfMonth.first },
			// Once every four years, not every year.
			everyYear: !(month.first === 2 && dayOfMonth.first === 29),
		};
	},

	// 0 0 1 * *, the same day every month.
	function monthlyOnDay({ minute, hour, dayOfMonth, month, day }) {
		if (!minute.isSingleton || !hour.isSingleton || !month.isFull || day.kind !== 'monthDay') {
			return null;
		}
		return {
			id: 'monthlyOnDay',
			time: { hour: hour.first, minute: minute.first },
			monthDays: dayOfMonth.values,
			// The 29th, 30th and 31st skip the months that are too short, so
			// this is not every month.
			everyMonth: dayOfMonth.last <= 28,
		};
	},

	// 5 0 * 8 *, every day but only in certain months.
	function inMonths({ minute, hour, month, weekDays, day }) {
		if (!minute.isSingleton || !hour.isSingleton || month.isFull) {
			return null;
		}
		if (day.kind !== 'none') {
			return null;
		}
		return {
			id: 'inMonths',
			time: { hour: hour.first, minute: minute.first },
			months: month.values,
			days: weekDays,
		};
	},
];

/**
 * Returns a descriptor for the expression, or null if no recognizer claims it.
 */
export function recognize(expression) {
	if (isNickname(expression)) {
		const expanded = expand(expression);
		return expanded === null ? { id: 'reboot' } : recognize(expanded);
	}

	const fields = parseExpression(expression);
	if (fields === null) {
		return null;
	}

	const day = dayModel(fields);
	if (day.kind === 'both') {
		return null;
	}

	// A schedule pinned to the calendar is described differently from one that
	// only turns on the clock, and the two sets of recognizers are disjoint.
	const onTheClock = day.kind === 'none' && fields.month.isFull;
	const resolved = { ...fields, day, weekDays: day.weekDays };

	for (const recognizer of onTheClock ? RECOGNIZERS : CALENDAR) {
		const descriptor = recognizer(resolved);
		if (descriptor !== null) {
			return descriptor;
		}
	}
	return null;
}
