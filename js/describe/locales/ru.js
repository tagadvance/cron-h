// Russian. Three plural categories where English has two, which is what the
// framework's use of Intl.PluralRules is for. Intl names weekdays only in the
// nominative, so the dative plurals that "по понедельникам" needs are listed
// here; there is no API that will produce them.

const MINUTES = { one: 'минуту', few: 'минуты', many: 'минут', other: 'минут' };
const HOURS = { one: 'час', few: 'часа', many: 'часов', other: 'часов' };
const RUNS = { one: 'запуск', few: 'запуска', many: 'запусков', other: 'запусков' };

const DATIVE = [
	'воскресеньям',
	'понедельникам',
	'вторникам',
	'средам',
	'четвергам',
	'пятницам',
	'субботам'
];

const WEEKDAYS = [1, 2, 3, 4, 5];
const WEEKEND = [0, 6];

const sameDays = (days, group) => days.length === group.length && group.every((day) => days.includes(day));

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
		language: 'Язык',
		nextRuns: (count, f) => `Следующие ${f.number(count)} ${f.plural(count, RUNS)}`,
		atStartup: 'Запускается при старте системы, поэтому вычислить следующий запуск нельзя.',
		never: 'Не запускается никогда. Ни одна дата не подходит под это выражение.',
		privacy: 'Время запуска вычисляется в вашем браузере, в вашем часовом поясе. Ваш crontab никуда не отправляется.',
		source: 'Исходный код на GitHub'
	},
	messages: {
		reboot: () => 'Один раз при запуске системы',

		everyMinute: ({ days }, f) => `Каждую минуту${allDay(days, f)}`,

		minuteInterval: ({ step, offset, days }, f) => {
			const from = offset === 0 ? '' : `, начиная с ${f.number(offset)}-й минуты`;
			return `Каждые ${f.number(step)} ${f.plural(step, MINUTES)}${from}${allDay(days, f)}`;
		},

		unevenMinuteInterval: ({ step, first, last, days }, f) =>
			`Каждые ${f.number(step)} ${f.plural(step, MINUTES)} с ${f.number(first)} по ${f.number(last)} минуту каждого часа, затем снова в начале часа${allDay(days, f)}`,

		minuteIntervalInHours: ({ step, hourStep, hourOffset, days }, f) => {
			if (hourStep === 2) {
				return `Каждые ${f.number(step)} ${f.plural(step, MINUTES)}, в ${hourOffset === 0 ? 'чётные' : 'нечётные'} часы${allDay(days, f)}`;
			}
			return `Каждые ${f.number(hourStep)} ${f.plural(hourStep, HOURS)}, затем каждые ${f.number(step)} ${f.plural(step, MINUTES)} в течение этого часа${allDay(days, f)}`;
		},

		hourly: ({ minute, days }, f) =>
			minute === 0
				? `Каждый час, ровно в начале часа${allDay(days, f)}`
				: `Каждый час, на ${f.number(minute)}-й минуте${allDay(days, f)}`,

		hourInterval: ({ step, time, days }, f) => {
			const from = time.hour === 0 && time.minute === 0 ? '' : `, начиная с ${f.time(time)}`;
			return `Каждые ${f.number(step)} ${f.plural(step, HOURS)}${from}${allDay(days, f)}`;
		},

		hourRange: ({ first, last, days }, f) =>
			`Каждый час с ${f.time(first)} до ${f.time(last)}${on(days, f)}`,

		unevenHourInterval: ({ step, first, last, days }, f) =>
			`Каждые ${f.number(step)} ${f.plural(step, HOURS)} с ${f.time(first)} до ${f.time(last)} каждый день, затем снова на следующий день${on(days, f)}`,

		atTime: ({ time, days }, f) =>
			days ? `${capitalize(when(days, f))} в ${f.time(time)}` : `Каждый день в ${f.time(time)}`
	}
};
