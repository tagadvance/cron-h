import cronstrue from './vendor/cronstrue.js';
import { Cron } from './vendor/croner.js';

// croner understands most crontab nicknames, but not these two: @midnight has
// no equivalent, and @reboot is not a schedule at all.
const UNSUPPORTED_NICKNAMES = {
	'@midnight': '0 0 * * *',
	'@reboot': null
};

const ENV_ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*\s*=/;

/**
 * Classify a single crontab line without interpreting the schedule.
 * Kinds: blank, comment, env, entry, error.
 */
export function parseLine(line) {
	const trimmed = line.trim();
	if (trimmed === '') {
		return { kind: 'blank' };
	}
	if (trimmed.startsWith('#')) {
		return { kind: 'comment' };
	}
	if (ENV_ASSIGNMENT.test(trimmed)) {
		return { kind: 'env' };
	}

	const fields = trimmed.split(/\s+/);
	if (fields[0].startsWith('@')) {
		return { kind: 'entry', expression: fields[0].toLowerCase(), command: fields.slice(1).join(' ') };
	}
	if (fields.length < 5) {
		return { kind: 'error', message: 'Expected five fields or an @nickname.' };
	}
	return { kind: 'entry', expression: fields.slice(0, 5).join(' '), command: fields.slice(5).join(' ') };
}

/** Throws if the expression cannot be parsed. */
export function describe(expression) {
	return cronstrue.toString(expression, { verbose: false, throwExceptionOnParseError: true });
}

/**
 * Upcoming run times, soonest first. Returns null for schedules that are not
 * time-based (@reboot) and an empty array for schedules that can never fire.
 */
export function nextRuns(expression, { count = 5, from = new Date(), timezone } = {}) {
	const nickname = expression.toLowerCase();
	const normalized = nickname in UNSUPPORTED_NICKNAMES ? UNSUPPORTED_NICKNAMES[nickname] : expression;
	if (normalized === null) {
		return null;
	}
	return new Cron(normalized, timezone ? { timezone } : {}).nextRuns(count, from);
}

export function interpretLine(line, options) {
	const parsed = parseLine(line);
	if (parsed.kind !== 'entry') {
		return parsed;
	}
	try {
		return { ...parsed, description: describe(parsed.expression), runs: nextRuns(parsed.expression, options) };
	} catch (error) {
		return { kind: 'error', message: error.message || String(error) };
	}
}

export function interpretCrontab(text, options) {
	return text.split(/\r?\n/).map((line, index) => ({ lineNumber: index + 1, line, ...interpretLine(line, options) }));
}
