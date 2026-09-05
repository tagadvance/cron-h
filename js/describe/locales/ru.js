// Russian. Three plural categories where English has two, which is what the
// framework's use of Intl.PluralRules is for. Intl names weekdays only in the
// nominative, so the dative plurals that "по понедельникам" needs are listed
// here; there is no API that will produce them.

const MINUTES = { one: 'минуту', few: 'минуты', many: 'минут', other: 'минут' };
const HOURS = { one: 'час', few: 'часа', many: 'часов', other: 'часов' };

// The determiner agrees too, and it is gendered: минута is feminine, час is
// masculine. Steps ending in 1 — 21, 31, 41, 51 — take the singular, so
// "Каждые 21 минуту" is wrong twice over.
const EVERY_MINUTES = { one: 'Каждую', few: 'Каждые', many: 'Каждые', other: 'Каждые' };
const EVERY_HOURS = { one: 'Каждый', few: 'Каждые', many: 'Каждые', other: 'Каждые' };
const RUNS = { one: 'запуск', few: 'запуска', many: 'запусков', other: 'запусков' };

const DATIVE = [
	'воскресеньям',
	'понедельникам',
	'вторникам',
	'средам',
	'четвергам',
	'пятницам',
	'субботам',
];

const WEEKDAYS = [1, 2, 3, 4, 5];
const WEEKEND = [0, 6];

const sameDays = (days, group) =>
	days.length === group.length && group.every((day) => days.includes(day));

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

function when(days, f) {
	if (sameDays(days, WEEKDAYS)) {
		return 'по будням';
	}
	if (sameDays(days, WEEKEND)) {
		return 'по выходным';
	}
	return `по ${f.list(days.map((day) => DATIVE[day]))}`;
}

const on = (days, f) => (days ? `, ${when(days, f)}` : '');

const allDay = (days, f) => (days ? `, ${when(days, f)} весь день` : '');

// Intl names months in the nominative, but "в августе" needs the
// prepositional. There is no API for that, so the twelve words live here.
const PREPOSITIONAL = [
	'январе',
	'феврале',
	'марте',
	'апреле',
	'мае',
	'июне',
	'июле',
	'августе',
	'сентябре',
	'октябре',
	'ноябре',
	'декабре',
];

const inMonthNames = (values, f) => f.list(values.map((month) => PREPOSITIONAL[month - 1]));

const monthDays = (values, f) => `${f.list(values.map((day) => `${f.number(day)}-го`))} числа`;

export default {
	code: 'ru',
	name: 'Русский',
	fallback: 'ru',
	ui: {
		tagline: 'Понятный человеку интерпретатор cron.',
		instructions: 'Инструкция:',
		step1: 'Скопируйте и вставьте содержимое вашего cron-файла в поле ниже.',
		step2: 'Каждое найденное расписание объясняется ниже вместе с ближайшими запусками.',
		empty: 'Вставьте crontab выше, чтобы увидеть, что он делает.',
		notASchedule: 'Это не расписание: ожидались пять полей, разделённых пробелами, или @псевдоним.',
		unreadable: 'cron не принял бы эту строку.',
		language: 'Язык',
		nextRuns: (count, f) => `Следующие ${f.number(count)} ${f.plural(count, RUNS)}`,
		atStartup: 'Запускается при старте системы, поэтому вычислить следующий запуск нельзя.',
		never: 'Не запускается никогда. Ни одна дата не подходит под это выражение.',
		privacy:
			'Время запуска вычисляется в вашем браузере, в вашем часовом поясе. Ваш crontab никуда не отправляется.',
		examples: 'Примеры',
		examplesTitle: 'Примеры выражений cron',
		examplesIntro:
			'Часто встречающиеся расписания crontab и что они значат на самом деле. Выберите любое, чтобы открыть его в интерпретаторе.',
		columnExpression: 'Выражение',
		columnMeaning: 'Значение',
		backToTool: 'Открыть интерпретатор',
		sponsor: 'Поддержать',
		source: 'Исходный код на GitHub',
	},
	messages: {
		reboot: () => 'Один раз при запуске системы',

		everyMinute: ({ days }, f) => `Каждую минуту${allDay(days, f)}`,

		minuteInterval: ({ step, offset, days }, f) => {
			const from = offset === 0 ? '' : `, начиная с ${f.number(offset)}-й минуты`;
			return `${f.plural(step, EVERY_MINUTES)} ${f.number(step)} ${f.plural(step, MINUTES)}${from}${allDay(days, f)}`;
		},

		unevenMinuteInterval: ({ step, first, last, days }, f) =>
			`${step === 1 ? 'Каждую минуту' : `${f.plural(step, EVERY_MINUTES)} ${f.number(step)} ${f.plural(step, MINUTES)}`} с ${f.number(first)} по ${f.number(last)} минуту каждого часа, затем снова на ${f.number(first)}-й минуте следующего${allDay(days, f)}`,

		minuteIntervalInHours: ({ step, hourStep, hourOffset, days }, f) => {
			if (hourStep === 2) {
				return `${f.plural(step, EVERY_MINUTES)} ${f.number(step)} ${f.plural(step, MINUTES)}, в ${hourOffset === 0 ? 'чётные' : 'нечётные'} часы${allDay(days, f)}`;
			}
			return `${f.plural(hourStep, EVERY_HOURS)} ${f.number(hourStep)} ${f.plural(hourStep, HOURS)}, затем каждые ${f.number(step)} ${f.plural(step, MINUTES)} в течение этого часа${allDay(days, f)}`;
		},

		hourly: ({ minute, days }, f) =>
			minute === 0
				? `Каждый час, ровно в начале часа${allDay(days, f)}`
				: `Каждый час, на ${f.number(minute)}-й минуте${allDay(days, f)}`,

		hourInterval: ({ step, time, days }, f) => {
			const from = time.hour === 0 && time.minute === 0 ? '' : `, начиная с ${f.time(time)}`;
			return `${f.plural(step, EVERY_HOURS)} ${f.number(step)} ${f.plural(step, HOURS)}${from}${allDay(days, f)}`;
		},

		minuteIntervalInHourRange: ({ step, first, last, days }, f) =>
			`${f.plural(step, EVERY_MINUTES)} ${f.number(step)} ${f.plural(step, MINUTES)} с ${f.time(first)} до ${f.time(last)}${on(days, f)}`,

		hourRange: ({ first, last, days }, f) =>
			`Каждый час с ${f.time(first)} до ${f.time(last)}${on(days, f)}`,

		unevenHourInterval: ({ step, first, last, days }, f) =>
			`${f.plural(step, EVERY_HOURS)} ${f.number(step)} ${f.plural(step, HOURS)} с ${f.time(first)} до ${f.time(last)} каждый день, затем снова на следующий день${on(days, f)}`,

		monthlyOnDay: ({ time, monthDays: values, everyMonth }, f) =>
			everyMonth
				? `Каждый месяц ${monthDays(values, f)} в ${f.time(time)}`
				: `${capitalize(monthDays(values, f))} каждого месяца, где оно есть, в ${f.time(time)}`,

		yearlyOnDate: ({ time, date, everyYear }, f) =>
			everyYear
				? `Каждый год ${f.date(date)} в ${f.time(time)}`
				: `Каждый високосный год ${f.date(date)} в ${f.time(time)}`,

		inMonths: ({ time, months, days }, f) =>
			days
				? `В ${inMonthNames(months, f)} ${when(days, f)} в ${f.time(time)}`
				: `В ${inMonthNames(months, f)} каждый день в ${f.time(time)}`,

		dayOfMonthOrWeek: ({ time, monthDays: values, days }, f) =>
			`Каждый месяц ${monthDays(values, f)} в ${f.time(time)}, а также ${when(days, f)} в ${f.time(time)}: ` +
			`cron запускается, когда выполняется любое из двух условий, а не только когда оба сразу`,

		atTime: ({ time, days }, f) =>
			days ? `${capitalize(when(days, f))} в ${f.time(time)}` : `Каждый день в ${f.time(time)}`,
	},
};
