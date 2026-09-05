// Japanese. No plural forms and no spaces; qualifiers precede what they
// qualify, so the day clause leads the sentence rather than trailing it as it
// does in the European languages.

const WEEKDAYS = [1, 2, 3, 4, 5];
const WEEKEND = [0, 6];

const sameDays = (days, group) => days.length === group.length && group.every((day) => days.includes(day));

function when(days, f) {
	if (sameDays(days, WEEKDAYS)) {
		return '平日';
	}
	if (sameDays(days, WEEKEND)) {
		return '週末';
	}
	return f.weekdays(days);
}

const on = (days, f) => (days ? `、${when(days, f)}` : '');

const allDay = (days, f) => (days ? `、${when(days, f)}終日` : '');

const every = (days, f) => (sameDays(days, WEEKDAYS) || sameDays(days, WEEKEND) ? when(days, f) : `毎週${when(days, f)}`);

const monthDays = (values, f) => f.list(values.map((day) => `${f.number(day)}日`));

export default {
	code: 'ja',
	name: '日本語',
	fallback: 'ja',
	ui: {
		tagline: '人間が読める cron インタプリタ。',
		instructions: '使い方:',
		step1: 'cron ファイルの内容を下のテキストエリアに貼り付けてください。',
		step2: '見つかったスケジュールごとに、意味と次回以降の実行時刻を下に表示します。',
		empty: '上に crontab を貼り付けると、その内容を表示します。',
		language: '言語',
		nextRuns: (count, f) => `次回以降の${f.number(count)}回の実行`,
		atStartup: 'システム起動時に実行されるため、次回の実行時刻は計算できません。',
		never: '一度も実行されません。この式に一致する日付はありません。',
		privacy: '実行時刻はお使いのブラウザで、ローカルのタイムゾーンで計算されます。crontab がどこかに送信されることはありません。',
		examples: '例',
		examplesTitle: 'cron 式の例',
		examplesIntro: 'よく使われる crontab のスケジュールと、その実際の意味です。選択するとインタプリタで開きます。',
		columnExpression: '式',
		columnMeaning: '意味',
		backToTool: 'インタプリタを開く',
		sponsor: 'スポンサー',
		source: 'GitHub のソースコード'
	},
	messages: {
		reboot: () => 'システム起動時に1回',

		everyMinute: ({ days }, f) => `毎分${allDay(days, f)}`,

		minuteInterval: ({ step, offset, days }, f) => {
			const from = offset === 0 ? '' : `（毎時${f.number(offset)}分から）`;
			return `${f.number(step)}分ごと${from}${allDay(days, f)}`;
		},

		unevenMinuteInterval: ({ step, first, last, days }, f) =>
			`毎時${f.number(first)}分から${f.number(last)}分まで${f.number(step)}分ごと、その後は正時に再開${allDay(days, f)}`,

		minuteIntervalInHours: ({ step, hourStep, hourOffset, days }, f) => {
			if (hourStep === 2) {
				return `${f.number(step)}分ごと、${hourOffset === 0 ? '偶数' : '奇数'}時のみ${allDay(days, f)}`;
			}
			return `${f.number(hourStep)}時間ごと、その時間内は${f.number(step)}分ごと${allDay(days, f)}`;
		},

		hourly: ({ minute, days }, f) => `毎時${f.number(minute)}分${allDay(days, f)}`,

		hourInterval: ({ step, time, days }, f) => {
			const from = time.hour === 0 && time.minute === 0 ? '' : `、${f.time(time)}から`;
			return `${f.number(step)}時間ごと${from}${allDay(days, f)}`;
		},

		minuteIntervalInHourRange: ({ step, first, last, days }, f) =>
			`${f.time(first)}から${f.time(last)}まで${f.number(step)}分ごと${on(days, f)}`,

		hourRange: ({ first, last, days }, f) =>
			`${f.time(first)}から${f.time(last)}まで毎時${on(days, f)}`,

		unevenHourInterval: ({ step, first, last, days }, f) =>
			`毎日${f.time(first)}から${f.time(last)}まで${f.number(step)}時間ごと、その後は翌日に再開${on(days, f)}`,

		monthlyOnDay: ({ time, monthDays: values }, f) =>
			`毎月${monthDays(values, f)}の${f.time(time)}`,

		yearlyOnDate: ({ time, date }, f) => `毎年${f.date(date)}の${f.time(time)}`,

		inMonths: ({ time, months, days }, f) =>
			days
				? `${f.months(months)}の${every(days, f)}の${f.time(time)}`
				: `${f.months(months)}の毎日${f.time(time)}`,

		dayOfMonthOrWeek: ({ time, monthDays: values, days }, f) =>
			`毎月${monthDays(values, f)}の${f.time(time)}、および毎週${when(days, f)}の${f.time(time)}。` +
			`cron はどちらか一方が一致した時点で実行され、両方が揃う必要はありません`,

		atTime: ({ time, days }, f) => (days ? `${every(days, f)}の${f.time(time)}` : `毎日${f.time(time)}`)
	}
};
