// The @nicknames every cron implementation accepts, expanded to their five
// field equivalents. @reboot expands to nothing: it is not a schedule.
const NICKNAMES = {
	'@yearly': '0 0 1 1 *',
	'@annually': '0 0 1 1 *',
	'@monthly': '0 0 1 * *',
	'@weekly': '0 0 * * 0',
	'@daily': '0 0 * * *',
	'@midnight': '0 0 * * *',
	'@hourly': '0 * * * *',
	'@reboot': null,
};

export function isNickname(expression) {
	return expression.trim().toLowerCase() in NICKNAMES;
}

/**
 * Returns the five field form of a nickname, null for @reboot, and the
 * expression unchanged if it is not a nickname.
 */
export function expand(expression) {
	const nickname = expression.trim().toLowerCase();
	return nickname in NICKNAMES ? NICKNAMES[nickname] : expression;
}
