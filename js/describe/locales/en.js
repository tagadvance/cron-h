// A locale is a module, not a data file, so it can make its own decisions about
// plurals, word order and cultural facts without the core knowing about them.
// Which days count as "the weekend" is one of those facts, and it is not the
// same everywhere, which is exactly why it lives here.

const MINUTES = { one: 'minute', other: 'minutes' };
const HOURS = { one: 'hour', other: 'hours' };

// st/nd/rd/th, which Intl gives us the categories for but not the suffixes.
const ORDINALS = { one: 'st', two: 'nd', few: 'rd', other: 'th' };

const WEEKDAYS = [1, 2, 3, 4, 5];
const WEEKEND = [0, 6];

const sameDays = (days, group) =>
	days.length === group.length && group.every((day) => days.includes(day));

function group(days) {
	if (sameDays(days, WEEKDAYS)) {
		return { one: 'weekday', many: 'weekdays' };
	}
	if (sameDays(days, WEEKEND)) {
		return { one: 'weekend', many: 'weekends' };
	}
	return null;
}

// "all day Sunday" for schedules that repeat throughout the day, "Every Sunday"
// for ones that fire at a point in time.
// "every weekday", not "every Monday, Tuesday, Wednesday, Thursday, and
// Friday". atTime used to be the only message that collapsed these.
const eachDay = (days, f) => {
	const named = group(days);
	return named ? named.one : f.weekdays(days);
};

// A windowed schedule is not an all-day one, so it takes the plain clause.
function on(days, f) {
	if (!days) {
		return '';
	}
	const named = group(days);
	return `, on ${named ? named.many : f.weekdays(days)}`;
}

function allDay(days, f) {
	if (!days) {
		return '';
	}
	const named = group(days);
	return named ? `, all day on ${named.many}` : `, all day ${f.weekdays(days)}`;
}

const past = (minute) => `:${String(minute).padStart(2, '0')}`;

const ordinal = (value, f) => `${f.number(value)}${ORDINALS[f.ordinal(value)] ?? 'th'}`;

export default {
	code: 'en',
	name: 'English',
	fallback: 'en',
	ui: {
		tagline: 'The human readable cron interpreter.',
		instructions: 'Instructions:',
		step1: 'Copy and paste the contents of your cron file into the textarea below.',
		step2: 'Every schedule it finds is explained underneath, along with its next few run times.',
		empty: 'Paste a crontab above to see what it does.',
		language: 'Language',
		nextRuns: (count, f) => `Next ${f.number(count)} runs`,
		atStartup: 'Runs at system startup, so there is no next run to calculate.',
		never: 'Never runs. No date satisfies this expression.',
		privacy:
			'Run times are calculated in your browser, in your local time zone. Your crontab is never uploaded anywhere.',
		examples: 'Examples',
		examplesTitle: 'Cron expression examples',
		examplesIntro:
			'Common crontab schedules and what they actually mean. Pick one to open it in the interpreter.',
		columnExpression: 'Expression',
		columnMeaning: 'Means',
		backToTool: 'Open the interpreter',
		sponsor: 'Sponsor',
		source: 'Source on GitHub',
	},
	messages: {
		reboot: () => 'Once at system startup',

		everyMinute: ({ days }, f) => `Every minute${allDay(days, f)}`,

		minuteInterval: ({ step, offset, days }, f) => {
			const from = offset === 0 ? '' : `, starting at ${past(offset)}`;
			return `Every ${f.number(step)} ${f.plural(step, MINUTES)}${from}${allDay(days, f)}`;
		},

		unevenMinuteInterval: ({ step, first, last, days }, f) =>
			`${step === 1 ? 'Every minute' : `Every ${f.number(step)} ${f.plural(step, MINUTES)}`} from ${past(first)} to ${past(last)} of each hour, then again at ${past(first)} of the next${allDay(days, f)}`,

		minuteIntervalInHours: ({ step, hourStep, hourOffset, days }, f) => {
			const every = `Every ${f.number(step)} ${f.plural(step, MINUTES)}`;
			if (hourStep === 2) {
				return `${every}, during ${hourOffset === 0 ? 'even' : 'odd'}-numbered hours${allDay(days, f)}`;
			}
			return `Every ${f.number(hourStep)} ${f.plural(hourStep, HOURS)}, then every ${f.number(step)} ${f.plural(step, MINUTES)} within that hour${allDay(days, f)}`;
		},

		hourly: ({ minute, days }, f) =>
			minute === 0
				? `Every hour, on the hour${allDay(days, f)}`
				: `Every hour at ${past(minute)}${allDay(days, f)}`,

		hourInterval: ({ step, time, days }, f) => {
			const from = time.hour === 0 && time.minute === 0 ? '' : `, starting at ${f.time(time)}`;
			return `Every ${f.number(step)} ${f.plural(step, HOURS)}${from}${allDay(days, f)}`;
		},

		minuteIntervalInHourRange: ({ step, first, last, days }, f) =>
			`Every ${f.number(step)} ${f.plural(step, MINUTES)} from ${f.time(first)} to ${f.time(last)}${on(days, f)}`,

		hourRange: ({ first, last, days }, f) =>
			`Every hour from ${f.time(first)} to ${f.time(last)}${on(days, f)}`,

		unevenHourInterval: ({ step, first, last, days }, f) =>
			`Every ${f.number(step)} ${f.plural(step, HOURS)} from ${f.time(first)} to ${f.time(last)} each day, then again the next day${on(days, f)}`,

		monthlyOnDay: ({ time, monthDays, everyMonth }, f) => {
			const on = f.list(monthDays.map((day) => ordinal(day, f)));
			// The 29th, 30th and 31st do not come round every month.
			return everyMonth
				? `Every month on the ${on} at ${f.time(time)}`
				: `On the ${on} of every month that has one, at ${f.time(time)}`;
		},

		yearlyOnDate: ({ time, date, everyYear }, f) =>
			everyYear
				? `Every year on ${f.date(date)} at ${f.time(time)}`
				: `Every leap year on ${f.date(date)} at ${f.time(time)}`,

		inMonths: ({ time, months, days }, f) =>
			days
				? `Every ${eachDay(days, f)} in ${f.months(months)} at ${f.time(time)}`
				: `Every day in ${f.months(months)} at ${f.time(time)}`,

		// Said at length on purpose. Reading this as "Friday the 13th" is the
		// single most common mistake people make with cron.
		dayOfMonthOrWeek: ({ time, monthDays, days }, f) =>
			`Every month on the ${f.list(monthDays.map((day) => ordinal(day, f)))} at ${f.time(time)}, ` +
			`and also every ${eachDay(days, f)} at ${f.time(time)} — cron runs this when either matches, ` +
			`not only when both do`,

		atTime: ({ time, days }, f) => {
			if (!days) {
				return `Every day at ${f.time(time)}`;
			}
			const named = group(days);
			return `Every ${named ? named.one : f.weekdays(days)} at ${f.time(time)}`;
		},
	},
};
