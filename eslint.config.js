import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default [
	{ ignores: ['node_modules/', 'js/vendor/'] },
	js.configs.recommended,
	{
		languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
		rules: {
			eqeqeq: ['error', 'always'],
			'no-var': 'error',
			'prefer-const': 'error',
			'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
			'no-console': ['error', { allow: ['warn', 'error'] }],
		},
	},
	// The site runs in a browser; the generators and tests run in node. Code
	// reaching for the wrong environment's globals is a bug worth catching here.
	{ files: ['js/**/*.js'], languageOptions: { globals: globals.browser } },
	{
		files: ['bin/**/*.js', 'test/**/*.js', 'eslint.config.js'],
		languageOptions: { globals: globals.node },
		rules: { 'no-console': 'off' },
	},
	prettier,
];
