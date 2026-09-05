// A cron field, reduced to the set of values it matches plus the structure of
// that set. The syntax that produced it is deliberately discarded: */15 and
// 0,15,30,45 match the same minutes and should be described the same way.

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export const SPECS = [
	{ name: 'minute', min: 0, max: 59, cyclic: true },
	{ name: 'hour', min: 0, max: 23, cyclic: true },
	// Month lengths vary, so a stride over days of the month has no fixed
	// wrap-around gap and can never be honestly called "every N days".
	{ name: 'dayOfMonth', min: 1, max: 31, cyclic: false },
	{ name: 'month', min: 1, max: 12, names: MONTHS, cyclic: true },
	{ name: 'dayOfWeek', min: 0, max: 6, parseMax: 7, names: DAYS, cyclic: true },
];

function parseValue(token, spec) {
	const named = spec.names ? spec.names.indexOf(token.toLowerCase()) : -1;
	if (named !== -1) {
		return named + spec.min;
	}
	if (!/^\d+$/.test(token)) {
		return null;
	}
	const value = Number(token);
	const max = spec.parseMax ?? spec.max;
	return value >= spec.min && value <= max ? value : null;
}

/**
 * Returns an analysis of the field, or null if the syntax is not one this
 * describer handles. Returning null is not an error: the caller falls back to
 * a general purpose describer, so this parser can afford to be strict.
 */
export function parseField(text, spec) {
	const values = new Set();

	for (const part of text.split(',')) {
		const [rangeText, stepText, ...extra] = part.split('/');
		if (extra.length > 0 || (stepText !== undefined && !/^[1-9]\d*$/.test(stepText))) {
			return null;
		}
		const step = stepText === undefined ? 1 : Number(stepText);

		let start;
		let end;
		if (rangeText === '*') {
			start = spec.min;
			end = spec.max;
		} else {
			const bounds = rangeText.split('-');
			if (bounds.length > 2) {
				return null;
			}
			start = parseValue(bounds[0], spec);
			// A bare value with a step, as in 5/10, runs to the end of the field.
			end =
				bounds.length === 2
					? parseValue(bounds[1], spec)
					: stepText === undefined
						? start
						: spec.max;
			if (start === null || end === null || start > end) {
				return null;
			}
		}

		for (let value = start; value <= end; value += step) {
			// Sunday is both 0 and 7, so a range like 5-7 has to be collected
			// before it can be normalized.
			values.add(spec.parseMax !== undefined && value > spec.max ? spec.min : value);
		}
	}

	return values.size === 0
		? null
		: analyze(
				[...values].sort((a, b) => a - b),
				spec,
			);
}

function analyze(values, spec) {
	const first = values[0];
	const last = values[values.length - 1];

	let stride = null;
	if (values.length >= 2) {
		const step = values[1] - values[0];
		stride = values.every((value, index) => index === 0 || value - values[index - 1] === step)
			? step
			: null;
	}

	// The gap from the last value of one cycle to the first of the next. Unless
	// it equals the stride, the field does not fire at an even interval: */7
	// minutes runs at :00 through :56 and then again 4 minutes later, so
	// calling it "every 7 minutes" is a lie.
	const wrap = spec.max + 1 - last + (first - spec.min);

	return {
		spec,
		values,
		first,
		last,
		stride,
		isFull: values.length === spec.max - spec.min + 1,
		isSingleton: values.length === 1,
		isEvenCycle: spec.cyclic && stride !== null && wrap === stride,
	};
}

/** Parses a five field expression, or returns null if any field is unsupported. */
export function parseExpression(expression) {
	// Cron separates fields with spaces and tabs only. JavaScript's \s also
	// matches NBSP, the en/em spaces and the ideographic space, which are common
	// in text copied out of a web page or a PDF and which a real crontab cannot
	// contain. Splitting on them would describe a line cron is going to reject.
	const fields = expression.replace(/^[ \t]+|[ \t]+$/g, '').split(/[ \t]+/);
	if (fields.length !== SPECS.length) {
		return null;
	}

	const parsed = {};
	for (const [index, spec] of SPECS.entries()) {
		const field = parseField(fields[index], spec);
		if (field === null) {
			return null;
		}
		parsed[spec.name] = field;
	}
	return parsed;
}
