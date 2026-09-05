import cronstrue from '../vendor/cronstrue.js';

// cronstrue ships one bundle per language and one containing all of them. The
// combined bundle is ten times the size of the English one, so it is fetched
// only when a reader actually picks another language.

let translator = cronstrue;
let pending = null;

export function translate(expression, code) {
	return translator.toString(expression, {
		locale: code,
		verbose: false,
		throwExceptionOnParseError: true,
	});
}

export const hasTranslations = () => translator !== cronstrue;

/**
 * Resolves once the translated fallback is available, and resolves rather than
 * rejects if it never arrives — the page stays useful either way, because
 * every recognized schedule is translated locally.
 */
export function loadTranslations() {
	if (pending === null) {
		pending = import('../vendor/cronstrue-i18n.js')
			.then((module) => {
				translator = module.default;
			})
			.catch((error) => {
				// Remembered as settled, not retried. A rejected promise kept here
				// would attach a fresh unhandled rejection on every keystroke.
				console.warn('cron-h: translated descriptions unavailable', error);
			});
	}
	return pending;
}
