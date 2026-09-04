import { Cron } from './vendor/croner.js';
import { describe } from './describe/index.js';
import { expand } from './nicknames.js';

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


/**
 * Upcoming run times, soonest first. Returns null for schedules that are not
 * time-based (@reboot) and an empty array for schedules that can never fire.
 */
export function nextRuns(expression, { count = 5, from = new Date(), timezone } = {}) {
	// croner rejects the nicknames it does not know, so every one of them is
	// expanded before it gets there.
	const normalized = expand(expression);
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
		return {
			...parsed,
			description: describe(parsed.expression, options),
			runs: nextRuns(parsed.expression, options)
		};
	} catch (error) {
		return { kind: 'error', message: error.message || String(error) };
	}
}

export function interpretCrontab(text, options) {
	return text.split(/\r?\n/).map((line, index) => ({ lineNumber: index + 1, line, ...interpretLine(line, options) }));
}
