// French. Weekday plurals are regular — every day takes a plain -s — so unlike
// Spanish no table is needed, only the article. Note the space before a colon.

const MINUTES = { one: 'minute', other: 'minutes' };
const HOURS = { one: 'heure', other: 'heures' };

const WEEKDAYS = [1, 2, 3, 4, 5];
const WEEKEND = [0, 6];

const sameDays = (days, group) =>
	days.length === group.length && group.every((day) => days.includes(day));

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

function when(days, f) {
	if (sameDays(days, WEEKDAYS)) {
		return 'en semaine';
	}
	if (sameDays(days, WEEKEND)) {
		return 'le week-end';
	}
	return `les ${f.list(f.weekdayNames(days).map((name) => `${name}s`))}`;
}

const on = (days, f) => (days ? `, ${when(days, f)}` : '');

const allDay = (days, f) => (days ? `, ${when(days, f)} toute la journée` : '');

// The first of the month is "1er"; every other day is a plain cardinal.
const frenchDay = (day, f) => (day === 1 ? '1er' : f.number(day));

const monthDays = (values, f) =>
	values.length === 1
		? `le ${frenchDay(values[0], f)}`
		: `les ${f.list(values.map((day) => frenchDay(day, f)))}`;

// Intl renders the date as "1 janvier"; French wants "1er janvier".
const frenchDate = (date, f) =>
	date.day === 1 ? f.date(date).replace(/^1\b/, '1er') : f.date(date);

export default {
	code: 'fr',
	name: 'Français',
	fallback: 'fr',
	ui: {
		tagline: "L'interpréteur de cron lisible par un humain.",
		instructions: 'Instructions :',
		step1: 'Copiez et collez le contenu de votre fichier cron dans la zone de texte ci-dessous.',
		step2: 'Chaque planification trouvée est expliquée en dessous, avec ses prochaines exécutions.',
		empty: 'Collez un crontab ci-dessus pour voir ce qu’il fait.',
		language: 'Langue',
		nextRuns: (count, f) => `${f.number(count)} prochaines exécutions`,
		atStartup:
			'S’exécute au démarrage du système ; il n’y a donc pas de prochaine exécution à calculer.',
		never: 'Ne s’exécute jamais. Aucune date ne satisfait cette expression.',
		privacy:
			'Les heures sont calculées dans votre navigateur, dans votre fuseau horaire. Votre crontab n’est jamais envoyé nulle part.',
		examples: 'Exemples',
		examplesTitle: 'Exemples d’expressions cron',
		examplesIntro:
			'Les planifications crontab courantes et ce qu’elles signifient réellement. Choisissez-en une pour l’ouvrir dans l’interpréteur.',
		columnExpression: 'Expression',
		columnMeaning: 'Signifie',
		backToTool: 'Ouvrir l’interpréteur',
		sponsor: 'Soutenir',
		source: 'Code source sur GitHub',
	},
	messages: {
		reboot: () => 'Une fois au démarrage du système',

		everyMinute: ({ days }, f) => `Chaque minute${allDay(days, f)}`,

		minuteInterval: ({ step, offset, days }, f) => {
			const from = offset === 0 ? '' : `, à partir de la minute ${f.number(offset)}`;
			return `Toutes les ${f.number(step)} ${f.plural(step, MINUTES)}${from}${allDay(days, f)}`;
		},

		unevenMinuteInterval: ({ step, first, last, days }, f) =>
			`Toutes les ${f.number(step)} ${f.plural(step, MINUTES)}, de la minute ${f.number(first)} à la minute ${f.number(last)} de chaque heure, puis de nouveau à la minute ${f.number(first)} de l’heure suivante${allDay(days, f)}`,

		minuteIntervalInHours: ({ step, hourStep, hourOffset, days }, f) => {
			if (hourStep === 2) {
				return `Toutes les ${f.number(step)} ${f.plural(step, MINUTES)}, aux heures ${hourOffset === 0 ? 'paires' : 'impaires'}${allDay(days, f)}`;
			}
			return `Toutes les ${f.number(hourStep)} ${f.plural(hourStep, HOURS)}, puis toutes les ${f.number(step)} ${f.plural(step, MINUTES)} au cours de cette heure${allDay(days, f)}`;
		},

		hourly: ({ minute, days }, f) =>
			minute === 0
				? `Toutes les heures, à l’heure pile${allDay(days, f)}`
				: `Toutes les heures, à la minute ${f.number(minute)}${allDay(days, f)}`,

		hourInterval: ({ step, time, days }, f) => {
			const from = time.hour === 0 && time.minute === 0 ? '' : `, à partir de ${f.time(time)}`;
			return `Toutes les ${f.number(step)} ${f.plural(step, HOURS)}${from}${allDay(days, f)}`;
		},

		minuteIntervalInHourRange: ({ step, first, last, days }, f) =>
			`Toutes les ${f.number(step)} ${f.plural(step, MINUTES)} de ${f.time(first)} à ${f.time(last)}${on(days, f)}`,

		hourRange: ({ first, last, days }, f) =>
			`Toutes les heures de ${f.time(first)} à ${f.time(last)}${on(days, f)}`,

		unevenHourInterval: ({ step, first, last, days }, f) =>
			`Toutes les ${f.number(step)} ${f.plural(step, HOURS)}, de ${f.time(first)} à ${f.time(last)} chaque jour, puis de nouveau le lendemain${on(days, f)}`,

		monthlyOnDay: ({ time, monthDays: values, everyMonth }, f) =>
			everyMonth
				? `Tous les mois ${monthDays(values, f)} à ${f.time(time)}`
				: `${capitalize(monthDays(values, f))} de chaque mois qui en compte un, à ${f.time(time)}`,

		yearlyOnDate: ({ time, date, everyYear }, f) =>
			everyYear
				? `Tous les ans le ${frenchDate(date, f)} à ${f.time(time)}`
				: `Chaque année bissextile le ${frenchDate(date, f)} à ${f.time(time)}`,

		inMonths: ({ time, months, days }, f) =>
			days
				? `En ${f.months(months)}, ${when(days, f)} à ${f.time(time)}`
				: `En ${f.months(months)}, tous les jours à ${f.time(time)}`,

		dayOfMonthOrWeek: ({ time, monthDays: values, days }, f) =>
			`Tous les mois ${monthDays(values, f)} à ${f.time(time)}, et aussi ${when(days, f)} à ${f.time(time)} : ` +
			`cron s’exécute dès que l’une des deux conditions est remplie, pas seulement quand les deux le sont`,

		atTime: ({ time, days }, f) =>
			days ? `${capitalize(when(days, f))} à ${f.time(time)}` : `Tous les jours à ${f.time(time)}`,
	},
};
