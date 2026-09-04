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
		return { id: 'minuteInterval', step: minute.stride, offset: minute.first, days: days(dayOfWeek) };
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
			days: days(dayOfWeek)
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
			days: days(dayOfWeek)
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
			days: days(dayOfWeek)
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
			days: days(dayOfWeek)
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
			days: days(dayOfWeek)
		};
	},

	// 0 3 * * 0
	function atTime({ minute, hour, dayOfWeek }) {
		if (!minute.isSingleton || !hour.isSingleton) {
			return null;
		}
		return { id: 'atTime', time: { hour: hour.first, minute: minute.first }, days: days(dayOfWeek) };
	}
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

	// Restricting the day of the month or the month itself puts the schedule
	// outside every pattern below, and a restricted day of the month alongside
	// a restricted day of the week means cron fires on either, which needs
	// wording of its own rather than a clause bolted onto one of these.
	if (!fields.dayOfMonth.isFull || !fields.month.isFull) {
		return null;
	}

	for (const recognizer of RECOGNIZERS) {
		const descriptor = recognizer(fields);
		if (descriptor !== null) {
			return descriptor;
		}
	}
	return null;
}
