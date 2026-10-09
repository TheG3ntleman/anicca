# Anicca frontend scaffold

Starting point for Anicca's executive-function and deep-work direction.
The app currently displays only an italic Anicca title.

## Retained infrastructure

- React, TypeScript, and Vite.
- Installable PWA with home-screen icons and offline asset caching.
- Modular dark blue/Dracula-inspired theme.
- Fixed, safe-area-aware viewport with keyboard viewport handling.
- Capability-based phone/desktop layout selection and reusable layout wrappers.
- GitHub Pages base path `/anicca/`.

The journaling composer, library, navigation, boxes, AST, and their dependencies
are preserved on `archive/journaling`. They are removed from this branch.
No recording, timers, analysis, or persistence features are implemented here.
Historical design notes in `docs/` remain available as references.

## Development

```sh
cd app/frontend
npm ci
npm run dev
```

Open the printed local URL at `/anicca/`. Changes update live.

## Production / PWA checks

```sh
npm run build
npm run preview
```

Service-worker functionality is enabled for the production build, not the
development server. On iPhone, open the deployed HTTPS site in Safari and use
Share → Add to Home Screen. Load online before testing offline launch.

The GitHub Pages workflow builds frontend changes on `main`. This branch does
not automatically deploy until deliberately selected or merged for deployment.
