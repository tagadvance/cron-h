// Portuguese. Weekday gender is not uniform: domingo and sábado are masculine,
// the -feira days feminine, so the article has to follow the days themselves.
// Plurals inflect both halves of a hyphenated name, segunda-feira becoming
// segundas-feiras. The hour takes a singular article at one o'clock.

const MINUTES = { one: 'minuto', other: 'minutos' };
const HOURS = { one: 'hora', other: 'horas' };

const WEEKDAYS = [1, 2, 3, 4, 5];
const WEEKEND = [0, 6];

const MASCULINE = [0, 6];

const sameDays = (days, group) => days.length === group.length && group.every((day) => days.includes(day));

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

const pluralize = (name) => name.split('-').map((part) => `${part}s`).join('-');

// "à 1:00" but "às 3:00".
const at = (time, f) => `${time.hour === 1 ? 'à' : 'às'} ${f.time(time)}`;
const from = (time, f) => `${time.hour === 1 ? 'da' : 'das'} ${f.time(time)}`;

function when(days, f) {
	if (sameDays(days, WEEKDAYS)) {
		return 'de segunda a sexta';
	}
	if (sameDays(days, WEEKEND)) {
		return 'nos fins de semana';
	}
	const article = days.every((day) => MASCULINE.includes(day)) ? 'aos' : 'às';
	return `${article} ${f.list(f.weekdayNames(days).map(pluralize))}`;
}

const allDay = (days, f) => (days ? `, ${when(days, f)} o dia todo` : '');

export default {
	code: 'pt',
	name: 'Português',
	fallback: 'pt_BR',
	ui: {
		tagline: 'O interpretador de cron legível por humanos.',
		instructions: 'Instruções:',
		step1: 'Copie e cole o conteúdo do seu arquivo cron na área de texto abaixo.',
		step2: 'Cada agendamento encontrado é explicado abaixo, junto com as próximas execuções.',
		empty: 'Cole um crontab acima para ver o que ele faz.',
		language: 'Idioma',
		nextRuns: (count, f) => `Próximas ${f.number(count)} execuções`,
		atStartup: 'Executa ao iniciar o sistema, portanto não há próxima execução a calcular.',
		never: 'Nunca executa. Nenhuma data satisfaz esta expressão.',
		privacy: 'Os horários são calculados no seu navegador, no seu fuso horário. Seu crontab nunca é enviado a lugar nenhum.',
		source: 'Código-fonte no GitHub'
	},
	messages: {
		reboot: () => 'Uma vez ao iniciar o sistema',

		everyMinute: ({ days }, f) => `A cada minuto${allDay(days, f)}`,

		minuteInterval: ({ step, offset, days }, f) => {
			const start = offset === 0 ? '' : `, a partir do minuto ${f.number(offset)}`;
			return `A cada ${f.number(step)} ${f.plural(step, MINUTES)}${start}${allDay(days, f)}`;
		},

		unevenMinuteInterval: ({ step, first, last, days }, f) =>
			`A cada ${f.number(step)} ${f.plural(step, MINUTES)}, do minuto ${f.number(first)} ao ${f.number(last)} de cada hora, e de novo ao começar a seguinte${allDay(days, f)}`,

		minuteIntervalInHours: ({ step, hourStep, hourOffset, days }, f) => {
			if (hourStep === 2) {
				return `A cada ${f.number(step)} ${f.plural(step, MINUTES)}, nas horas ${hourOffset === 0 ? 'pares' : 'ímpares'}${allDay(days, f)}`;
			}
			return `A cada ${f.number(hourStep)} ${f.plural(hourStep, HOURS)}, e depois a cada ${f.number(step)} ${f.plural(step, MINUTES)} dentro dessa hora${allDay(days, f)}`;
		},

		hourly: ({ minute, days }, f) =>
			minute === 0
				? `A cada hora, em ponto${allDay(days, f)}`
				: `A cada hora, no minuto ${f.number(minute)}${allDay(days, f)}`,

		hourInterval: ({ step, time, days }, f) => {
			const start = time.hour === 0 && time.minute === 0 ? '' : `, a partir ${from(time, f)}`;
			return `A cada ${f.number(step)} ${f.plural(step, HOURS)}${start}${allDay(days, f)}`;
		},

		unevenHourInterval: ({ step, first, last, days }, f) =>
			`A cada ${f.number(step)} ${f.plural(step, HOURS)}, ${from(first, f)} ${at(last, f)} todos os dias, e de novo no dia seguinte${allDay(days, f)}`,

		atTime: ({ time, days }, f) =>
			days ? `${capitalize(when(days, f))} ${at(time, f)}` : `Todos os dias ${at(time, f)}`
	}
};
