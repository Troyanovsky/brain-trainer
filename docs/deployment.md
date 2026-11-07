# GitHub → Cloudflare Pages

This application deploys as a static Cloudflare Pages site using native Git integration.

## Build configuration

- Production branch: `main`
- Root directory: repository root
- Node.js: `22.16.0`, pinned in `.node-version`
- Build command: `npm test && npm run build`
- Output directory: `dist`
- Frontend environment variables or secrets: none required

Cloudflare installs dependencies from `package-lock.json`, runs the logic tests and production build, and publishes the generated static assets. The build also generates the service-worker asset manifest needed for offline play.

Pushes to `main` trigger production deployments. Other branches use preview deployments when enabled in the Pages Git integration. Failed builds preserve the last successful production deployment.

## Local verification

```sh
npm ci
npm test
npm run build
npm run preview
```

Browser acceptance tests can be run with `npm run test:e2e`; they require Chrome or Playwright Chromium and are kept separate from the cloud build.

## Operational notes

- GitHub repository visibility and Pages website visibility are separate: a private repository may serve a public Pages site.
- Device profiles remain in each visitor's browser; deploying this static site does not upload local game histories.
- Offline play requires an initial successful online load and service-worker installation.
- Keep the site at the domain root because the app's assets and offline cache use root-relative URLs.
- No Cloudflare API credentials need to be committed to GitHub or configured as GitHub Actions secrets for native Git integration.
