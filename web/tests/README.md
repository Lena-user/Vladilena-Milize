# Web UI tests

Run the browser suite from `web/`:

```sh
npm run test:ui
```

The Playwright config starts Vite on `127.0.0.1:4177` with a strict port and mocks API responses in each test; it does not connect to the app database.

Install the Chromium browser once per environment when it is missing:

```sh
npx playwright install chromium
```

On a Linux machine missing Chromium system libraries, install the browser dependencies with:

```sh
npx playwright install --with-deps chromium
```
