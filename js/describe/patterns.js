import { parseExpression } from './fields.js';
import { expand, isNickname } from '../nicknames.js';

// Recognizers describe the shape of a schedule rather than its fields, and
// return a language-free descriptor: a message id plus typed parameters. The
// English never exists until a locale renders it, which is what makes multiple
// languages possible and lets the tests assert on meaning instead of wording.

const days = (dayOfWeek) => (dayOfWeek.isFull ? null : dayOfWeek.values);

// Every recognizer is tried in order; the first to return a descriptor wins.
// Anything not claimed here falls through to the general purpose describer, so
// the list can grow one honest pattern at a time.
const RECOGNIZERS = [
	// * * * * *
	function everyMinute({ minute, hour, dayOfWeek }) {
		if (!minute.isFull || !hour.isFull) {
			return null;
		}
		return { id: 'everyMinute', days: days(dayOfWeek) };
	},

	// */15 * * * *
	function minuteInterval({ minute, hour, dayOfWeek }) {
		if (!minute.isEvenCycle || !hour.isFull) {
			return null;
		}
		return {
			id: 'minuteInterval',
			step: minute.stride,
			offset: minute.first,
			days: days(dayOfWeek),
		};
	},

	// */7 * * * *, which fires at :00 through :56 and then again 4 minutes
	// later. Every other tool calls this "every 7 minutes"; it is not.
	function unevenMinuteInterval({ minute, hour, dayOfWeek }) {
		if (minute.stride === null || minute.isEvenCycle || !hour.isFull) {
			return null;
		}
		return {
			id: 'unevenMinuteInterval',
			step: minute.stride,
			first: minute.first,
			last: minute.last,
			days: days(dayOfWeek),
		};
	},

	// */15 */2 * * *
	function minuteIntervalInHours({ minute, hour, dayOfWeek }) {
		if (!minute.isEvenCycle || minute.first !== 0 || !hour.isEvenCycle || hour.first > 1) {
			return null;
		}
		return {
			id: 'minuteIntervalInHours',
			step: minute.stride,
			hourStep: hour.stride,
			hourOffset: hour.first,
			days: days(dayOfWeek),
		};
	},

	// 30 * * * *
	function hourly({ minute, hour, dayOfWeek }) {
		if (!minute.isSingleton || !hour.isFull) {
			return null;
		}
		return { id: 'hourly', minute: minute.first, days: days(dayOfWeek) };
	},

	// 0 */2 * * *
	function hourInterval({ minute, hour, dayOfWeek }) {
		if (!minute.isSingleton || !hour.isEvenCycle) {
			return null;
		}
		return {
			id: 'hourInterval',
			step: hour.stride,
			time: { hour: hour.first, minute: minute.first },
			days: days(dayOfWeek),
		};
	},

	// */15 9-17 * * *, a stride inside a window. The last firing is at :45 of
	// the final hour, not on the hour, which the wording has to reflect.
	function minuteIntervalInHourRange({ minute, hour, dayOfWeek }) {
		if (!minute.isEvenCycle || hour.stride !== 1 || hour.isFull) {
			return null;
		}
		return {
			id: 'minuteIntervalInHourRange',
			step: minute.stride,
			first: { hour: hour.first, minute: minute.first },
			last: { hour: hour.last, minute: minute.last },
			days: days(dayOfWeek),
		};
	},

	// 0 9-17 * * *, the business hours schedule. A stride of one is a plain
	// range and reads as one; without this it would be described as an uneven
	// interval of "every 1 hour".
	function hourRange({ minute, hour, dayOfWeek }) {
		if (!minute.isSingleton || hour.stride !== 1 || hour.isFull) {
			return null;
		}
		return {
			id: 'hourRange',
			first: { hour: hour.first, minute: minute.first },
			last: { hour: hour.last, minute: minute.first },
			days: days(dayOfWeek),
		};
	},

	// 0 */5 * * *, which runs out of day before the stride comes round again.
	function unevenHourInterval({ minute, hour, dayOfWeek }) {
		if (!minute.isSingleton || hour.stride === null || hour.isEvenCycle) {
			return null;
		}
		return {
			id: 'unevenHourInterval',
			step: hour.stride,
			first: { hour: hour.first, minute: minute.first },
			last: { hour: hour.last, minute: minute.first },
			days: days(dayOfWeek),
		};
	},

	// 0 3 * * 0
	function atTime({ minute, hour, dayOfWeek }) {
		if (!minute.isSingleton || !hour.isSingleton) {
			return null;
		}
		return {
			id: 'atTime',
			time: { hour: hour.first, minute: minute.first },
			days: days(dayOfWeek),
		};
	},
];

// Schedules that turn on the calendar rather than the clock. These are tried
// only when the day of the month or the month itself is restricted, which is
// exactly when the recognizers above decline.
const CALENDAR = [
	// 0 0 13 * FRI. Cron fires when *either* field matches, which is the most
	// misunderstood thing about it, so it gets wording of its own rather than a
	// clause bolted onto something else.
	function dayOfMonthOrWeek({ minute, hour, dayOfMonth, month, dayOfWeek }) {
		if (!minute.isSingleton || !hour.isSingleton || !month.isFull) {
			return null;
		}
		if (dayOfMonth.isFull || dayOfWeek.isFull) {
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
	function yearlyOnDate({ minute, hour, dayOfMonth, month, dayOfWeek }) {
		if (!minute.isSingleton || !hour.isSingleton || !dayOfWeek.isFull) {
			return null;
		}
		if (!dayOfMonth.isSingleton || !month.isSingleton) {
			return null;
		}
		return {
			id: 'yearlyOnDate',
			time: { hour: hour.first, minute: minute.first },
			date: { month: month.first, day: dayOfMonth.first },
		};
	},

	// 0 0 1 * *, the same day every month.
	function monthlyOnDay({ minute, hour, dayOfMonth, month, dayOfWeek }) {
		if (!minute.isSingleton || !hour.isSingleton || !dayOfWeek.isFull || !month.isFull) {
			return null;
		}
		if (dayOfMonth.isFull) {
			return null;
		}
		return {
			id: 'monthlyOnDay',
			time: { hour: hour.first, minute: minute.first },
			monthDays: dayOfMonth.values,
		};
	},

	// 5 0 * 8 *, every day but only in certain months.
	function inMonths({ minute, hour, dayOfMonth, month, dayOfWeek }) {
		if (!minute.isSingleton || !hour.isSingleton || !dayOfMonth.isFull || month.isFull) {
			return null;
		}
		return {
			id: 'inMonths',
			time: { hour: hour.first, minute: minute.first },
			months: month.values,
			days: days(dayOfWeek),
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

	// A schedule pinned to the calendar is described differently from one that
	// only turns on the clock, and the two sets of recognizers are disjoint.
	const onTheClock = fields.dayOfMonth.isFull && fields.month.isFull;

	for (const recognizer of onTheClock ? RECOGNIZERS : CALENDAR) {
		const descriptor = recognizer(fields);
		if (descriptor !== null) {
			return descriptor;
		}
	}
	return null;
}
