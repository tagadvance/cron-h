// Simplified Chinese. There are no plural forms, so every count takes the same
// measure word, and clauses are separated by the full width comma rather than
// a comma and a space. Weekdays use the short forms, 周日 rather than 星期日,
// which is what a Chinese interface would normally show.

const WEEKDAYS = [1, 2, 3, 4, 5];
const WEEKEND = [0, 6];

const sameDays = (days, group) => days.length === group.length && group.every((day) => days.includes(day));

function when(days, f) {
	if (sameDays(days, WEEKDAYS)) {
		return '工作日';
	}
	if (sameDays(days, WEEKEND)) {
		return '周末';
	}
	return f.weekdays(days, 'short');
}

const on = (days, f) => (days ? `，${when(days, f)}` : '');

const allDay = (days, f) => (days ? `，${when(days, f)}全天` : '');

const monthDays = (values, f) => f.list(values.map((day) => `${f.number(day)}号`));

export default {
	code: 'zh',
	name: '中文',
	fallback: 'zh_CN',
	ui: {
		tagline: '人类可读的 cron 解释器。',
		instructions: '使用说明：',
		step1: '将 cron 文件的内容复制粘贴到下面的文本框中。',
		step2: '每一条找到的计划任务都会在下方解释，并列出接下来的几次运行时间。',
		empty: '在上方粘贴 crontab 即可查看其含义。',
		language: '语言',
		nextRuns: (count, f) => `接下来 ${f.number(count)} 次运行`,
		atStartup: '在系统启动时运行，因此没有下次运行时间可以计算。',
		never: '永不运行。没有任何日期符合该表达式。',
		privacy: '运行时间在您的浏览器中按本地时区计算。您的 crontab 不会被上传到任何地方。',
		examples: '示例',
		examplesTitle: 'cron 表达式示例',
		examplesIntro: '常见的 crontab 计划任务及其真实含义。选择任意一条即可在解释器中打开。',
		columnExpression: '表达式',
		columnMeaning: '含义',
		backToTool: '打开解释器',
		sponsor: '赞助',
		source: '在 GitHub 上查看源代码'
	},
	messages: {
		reboot: () => '系统启动时运行一次',

		everyMinute: ({ days }, f) => `每分钟${allDay(days, f)}`,

		minuteInterval: ({ step, offset, days }, f) => {
			const from = offset === 0 ? '' : `，从第${f.number(offset)}分钟开始`;
			return `每${f.number(step)}分钟${from}${allDay(days, f)}`;
		},

		unevenMinuteInterval: ({ step, first, last, days }, f) =>
			`每小时的第${f.number(first)}分钟至第${f.number(last)}分钟之间每${f.number(step)}分钟一次，然后在整点重新开始${allDay(days, f)}`,

		minuteIntervalInHours: ({ step, hourStep, hourOffset, days }, f) => {
			if (hourStep === 2) {
				return `每${f.number(step)}分钟，在${hourOffset === 0 ? '偶数' : '奇数'}小时${allDay(days, f)}`;
			}
			return `每${f.number(hourStep)}小时，然后在该小时内每${f.number(step)}分钟一次${allDay(days, f)}`;
		},

		hourly: ({ minute, days }, f) =>
			minute === 0
				? `每小时整点${allDay(days, f)}`
				: `每小时的第${f.number(minute)}分钟${allDay(days, f)}`,

		hourInterval: ({ step, time, days }, f) => {
			const from = time.hour === 0 && time.minute === 0 ? '' : `，从${f.time(time)}开始`;
			return `每${f.number(step)}小时${from}${allDay(days, f)}`;
		},

		minuteIntervalInHourRange: ({ step, first, last, days }, f) =>
			`${f.time(first)}到${f.time(last)}之间每${f.number(step)}分钟${on(days, f)}`,

		hourRange: ({ first, last, days }, f) =>
			`${f.time(first)}到${f.time(last)}之间每小时${on(days, f)}`,

		unevenHourInterval: ({ step, first, last, days }, f) =>
			`每天从${f.time(first)}至${f.time(last)}每${f.number(step)}小时一次，然后次日重新开始${on(days, f)}`,

		monthlyOnDay: ({ time, monthDays: values }, f) =>
			`每月${monthDays(values, f)}${f.time(time)}`,

		yearlyOnDate: ({ time, date }, f) => `每年${f.date(date)}${f.time(time)}`,

		inMonths: ({ time, months, days }, f) =>
			days
				? `${f.months(months)}的${when(days, f)}${f.time(time)}`
				: `${f.months(months)}每天${f.time(time)}`,

		dayOfMonthOrWeek: ({ time, monthDays: values, days }, f) =>
			`每月${monthDays(values, f)}${f.time(time)}，以及每${when(days, f)}${f.time(time)}。` +
			`只要满足其中任意一个条件 cron 就会运行，并不需要同时满足`,

		atTime: ({ time, days }, f) => (days ? `每${when(days, f)}${f.time(time)}` : `每天${f.time(time)}`)
	}
};
