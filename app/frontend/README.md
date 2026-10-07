# Anicca PWA smoke test

A minimal React + TypeScript app displaying an italic Anicca title. The production build includes a
web app manifest, home-screen icons, and a service worker that caches the app
for offline launches. No entries or storage functionality yet.

## Local development

```sh
cd app/frontend
npm ci
npm run dev
```

To test the service worker locally, use a production build:

```sh
npm run build
npm run preview
```

Open the printed localhost URL with `/anicca/` appended. The development server
does not enable the service worker.

## GitHub Pages

For the immediate test, the built app is published to the `gh-pages` branch.
In repository Settings → Pages, choose **Deploy from a branch**, then
**gh-pages** and **/ (root)**.

For future automated deployments, the deployment workflow runs on frontend
changes pushed to `main`, or can be
started manually from the Actions tab on a branch containing this workflow.
In repository Settings → Pages, set the source to **GitHub Actions**.
The expected URL is https://theg3ntleman.github.io/anicca/ .
The Vite base and manifest scope are configured for this repository path.

## iPhone check

1. Open the deployed URL in Safari while online.
2. Use Share → Add to Home Screen. If shown, enable **Open as Web App**.
3. Launch Anicca using its Home Screen icon. Expect an italic Anicca title on white without
   Safari's address bar.
4. Leave it open online briefly so the service worker can finish caching.
5. Close the app, enable Airplane Mode (and disable Wi-Fi), and reopen it.
   The Anicca title should still load.

The visible title confirms that the app rendered, rather than showing an empty
screen because of a loading failure.
