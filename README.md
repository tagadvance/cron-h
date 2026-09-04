# cron-h

Human readable cron interpreter web application. Live at
[www.cron-h.com](https://www.cron-h.com).

Paste a crontab in; every schedule it finds is explained in English along with
its next five run times. Everything is calculated in the browser — nothing is
uploaded.

## Running it

There is no build step. Serve the directory with anything static:

```
python3 -m http.server 8000
```

The page is an ES module, so it needs to be served over HTTP; opening
`index.html` from the filesystem will not work.

## Tests

```
npm test
```

`node --test` only; there are no dev dependencies.

## Dependencies

Vendored under `js/vendor/` so the site has no runtime network dependency:

| Library | Version | Used for |
| --- | --- | --- |
| [cronstrue](https://github.com/bradymholt/cronstrue) | 3.24.0 | expression to English |
| [croner](https://github.com/hexagon/croner) | 9.1.0 | next run times |

Both are MIT licensed. To update one, re-download it over the existing file:

```
curl -o js/vendor/cronstrue.js https://cdn.jsdelivr.net/npm/cronstrue@3.24.0/+esm
curl -o js/vendor/croner.js https://cdn.jsdelivr.net/npm/croner@9.1.0/dist/croner.js
```
