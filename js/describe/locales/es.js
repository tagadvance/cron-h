// Spanish. Intl names weekdays in the singular, but "los domingos" needs the
// plural, and Spanish inflects only sábado and domingo. The hour takes a
// singular article at one o'clock and a plural one at every other hour.

const MINUTES = { one: 'minuto', other: 'minutos' };
const HOURS = { one: 'hora', other: 'horas' };

const WEEKDAYS = [1, 2, 3, 4, 5];
const WEEKEND = [0, 6];

const sameDays = (days, group) =>
	days.length === group.length && group.every((day) => days.includes(day));

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

// "la 1:00" but "las 2:00". Decided by the hour as rendered, not by the 24-hour
// value: es-MX shows 13:00 as "1:00 p.m.", which takes the singular.
const singular = (time, f) => /^1\D/.test(f.time(time));

const hour = (time, f) => `${singular(time, f) ? 'la' : 'las'} ${f.time(time)}`;

function when(days, f) {
	if (sameDays(days, WEEKDAYS)) {
		return 'de lunes a viernes';
	}
	if (sameDays(days, WEEKEND)) {
		return 'los fines de semana';
	}
	const names = f
		.weekdayNames(days)
		.map((name, index) => (days[index] % 6 === 0 ? `${name}s` : name));
	return `los ${f.list(names)}`;
}

const on = (days, f) => (days ? `, ${when(days, f)}` : '');

const allDay = (days, f) => (days ? `, ${when(days, f)} todo el día` : '');

// "el día 1" but "los días 1 y 15"; Spanish uses cardinals for dates.
const monthDays = (values, f) =>
	values.length === 1
		? `el día ${f.number(values[0])}`
		: `los días ${f.list(values.map((day) => f.number(day)))}`;

export default {
	code: 'es',
	name: 'Español',
	fallback: 'es',
	ui: {
		tagline: 'El intérprete de cron legible por humanos.',
		instructions: 'Instrucciones:',
		step1: 'Copia y pega el contenido de tu archivo cron en el área de texto de abajo.',
		step2: 'Cada programación que encuentre se explica debajo, junto con sus próximas ejecuciones.',
		empty: 'Pega un crontab arriba para ver qué hace.',
		notASchedule:
			'No es una programación: se esperaban cinco campos separados por espacios, o un @alias.',
		unreadable: 'cron no aceptaría esta línea.',
		language: 'Idioma',
		nextRuns: (count, f) => `Próximas ${f.number(count)} ejecuciones`,
		atStartup:
			'Se ejecuta al iniciar el sistema, así que no hay una próxima ejecución que calcular.',
		never: 'No se ejecuta nunca. Ninguna fecha satisface esta expresión.',
		privacy:
			'Las horas se calculan en tu navegador, en tu zona horaria local. Tu crontab nunca se envía a ningún sitio.',
		examples: 'Ejemplos',
		examplesTitle: 'Ejemplos de expresiones cron',
		examplesIntro:
			'Programaciones de crontab habituales y lo que significan en realidad. Elige una para abrirla en el intérprete.',
		columnExpression: 'Expresión',
		columnMeaning: 'Significa',
		backToTool: 'Abrir el intérprete',
		sponsor: 'Patrocinar',
		source: 'Código fuente en GitHub',
	},
	messages: {
		reboot: () => 'Una vez al iniciar el sistema',

		everyMinute: ({ days }, f) => `Cada minuto${allDay(days, f)}`,

		minuteInterval: ({ step, offset, days }, f) => {
			const from = offset === 0 ? '' : `, a partir del minuto ${f.number(offset)}`;
			return `Cada ${f.number(step)} ${f.plural(step, MINUTES)}${from}${allDay(days, f)}`;
		},

		unevenMinuteInterval: ({ step, first, last, days }, f) =>
			`${step === 1 ? 'Cada minuto' : `Cada ${f.number(step)} ${f.plural(step, MINUTES)}`}, del minuto ${f.number(first)} al ${f.number(last)} de cada hora, y de nuevo en el minuto ${f.number(first)} de la siguiente${allDay(days, f)}`,

		minuteIntervalInHours: ({ step, hourStep, hourOffset, days }, f) => {
			if (hourStep === 2) {
				return `Cada ${f.number(step)} ${f.plural(step, MINUTES)}, en las horas ${hourOffset === 0 ? 'pares' : 'impares'}${allDay(days, f)}`;
			}
			return `Cada ${f.number(hourStep)} ${f.plural(hourStep, HOURS)}, y luego cada ${f.number(step)} ${f.plural(step, MINUTES)} dentro de esa hora${allDay(days, f)}`;
		},

		hourly: ({ minute, days }, f) =>
			minute === 0
				? `Cada hora, en punto${allDay(days, f)}`
				: `Cada hora, en el minuto ${f.number(minute)}${allDay(days, f)}`,

		hourInterval: ({ step, time, days }, f) => {
			const from = time.hour === 0 && time.minute === 0 ? '' : `, a partir de ${hour(time, f)}`;
			return `Cada ${f.number(step)} ${f.plural(step, HOURS)}${from}${allDay(days, f)}`;
		},

		minuteIntervalInHourRange: ({ step, first, last, days }, f) =>
			`Cada ${f.number(step)} ${f.plural(step, MINUTES)} de ${hour(first, f)} a ${hour(last, f)}${on(days, f)}`,

		hourRange: ({ first, last, days }, f) =>
			`Cada hora de ${hour(first, f)} a ${hour(last, f)}${on(days, f)}`,

		unevenHourInterval: ({ step, first, last, days }, f) =>
			`Cada ${f.number(step)} ${f.plural(step, HOURS)}, de ${hour(first, f)} a ${hour(last, f)} cada día, y de nuevo al día siguiente${on(days, f)}`,

		monthlyOnDay: ({ time, monthDays: values, everyMonth }, f) =>
			everyMonth
				? `Todos los meses ${monthDays(values, f)} a ${hour(time, f)}`
				: `${capitalize(monthDays(values, f))} de cada mes que lo tenga, a ${hour(time, f)}`,

		yearlyOnDate: ({ time, date, everyYear }, f) =>
			everyYear
				? `Todos los años el ${f.date(date)} a ${hour(time, f)}`
				: `Cada año bisiesto el ${f.date(date)} a ${hour(time, f)}`,

		inMonths: ({ time, months, days }, f) =>
			days
				? `En ${f.months(months)}, ${when(days, f)} a ${hour(time, f)}`
				: `En ${f.months(months)}, todos los días a ${hour(time, f)}`,

		dayOfMonthOrWeek: ({ time, monthDays: values, days }, f) =>
			`Todos los meses ${monthDays(values, f)} a ${hour(time, f)}, y también ${when(days, f)} a ${hour(time, f)}: ` +
			`cron lo ejecuta cuando se cumple cualquiera de las dos condiciones, no solo cuando se cumplen ambas`,

		atTime: ({ time, days }, f) =>
			days
				? `${capitalize(when(days, f))} a ${hour(time, f)}`
				: `Todos los días a ${hour(time, f)}`,
	},
};
