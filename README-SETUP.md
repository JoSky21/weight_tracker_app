# Keep Moving — Vite 8 overlay

This zip adds a basic working React + TypeScript fitness tracker to the **existing Vite project** in `C:\Users\jojot\Desktop\weight_tracker_app`. It does **not** replace your package.json, package-lock.json, or linter settings.

## Setup in VS Code (Windows PowerShell)

1. In the first VS Code terminal, keep Vite running or press `q` then Enter to stop it.
2. Extract this ZIP **into** your existing `weight_tracker_app` directory (not into an extra `weight_tracker_overlay` subfolder). Allow replacement of starter `src/App.tsx`, `src/main.tsx`, `vite.config.ts`, and `index.html`.
3. In a **new terminal** in the project directory:
   ```powershell
   npm.cmd install firebase
   npm.cmd install -D vite-plugin-pwa
   Copy-Item .env.example .env.local
   ```
4. Firebase Console: create a Spark-plan project and register a **Web app**. Copy `apiKey`, `authDomain`, `projectId`, `appId` values to `.env.local` (the keys are `VITE_FIREBASE_*`). Keep `.env.local` out of Git; the standard Vite `.gitignore` already excludes `*.local`.
5. Firebase Console > Authentication > Sign-in method: enable Email/Password. Then Authentication > Users > Add user. Create **only your** account. Copy that user's UID.
6. Firebase Console > Firestore Database > Create database, **Standard edition** and **Production mode**. Under Firestore > Rules, paste the file `firestore.rules`, replace `YOUR_FIREBASE_USER_UID` with your account's UID, and click Publish. Rules must be published before logging workouts.
7. Run `npm.cmd run dev` (or stop and restart the existing Vite process). Visit `http://localhost:5173/` and sign in with your new account.
8. Add a workout. It should appear in the list, and also in Firestore under `users/<YOUR_UID>/workouts`.

## Publish on GitHub Pages (after testing locally)

1. Create a public repository named `weight_tracker_app` (or update `repoName` in `vite.config.ts`).
2. Commit and push this project, including `package-lock.json`; **never** commit `.env.local` or a Firebase service-account key.
3. On GitHub > Repository Settings > Secrets and variables > Actions, add four repository secrets matching `.env.example`'s keys, with actual Firebase web config values. Web config is not secret, but using Actions secrets keeps it out of the Git repository. The values are still visible to browser clients: Firestore Security Rules enforce data privacy.
4. Repository Settings > Pages > Build and deployment > Source = **GitHub Actions**. Push to main to deploy. Visit `https://YOUR_USERNAME.github.io/weight_tracker_app/`.
5. If using an OAuth provider later, add `YOUR_USERNAME.github.io` as an authorized domain in Firebase Authentication > Settings. Email/password in this starter does not require an OAuth redirect.

A PWA shell will be installable after deployment over HTTPS. Offline Firestore writes are **not configured**; network is needed for reliable cloud saving and synchronization. Later enhancements: weight history, weekly calendar, import/export, charts, and optional offline-first support.
