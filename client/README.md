# VoiceBridge frontend

React + Vite client for the existing Express API. The development server runs on port 5173 and proxies `/auth` and `/speech` (including WebSocket upgrades) to `http://localhost:3000`.

```sh
npm install
npm run dev
```

For production, build with `npm run build` and deploy `dist/` as a static site. Configure the host or reverse proxy to forward `/auth/*`, `/speech/*`, and WebSocket upgrades for `/speech/realtime` to the Express service on port 3000. Keeping the client and API on the same site lets the existing HTTP-only auth cookie work without backend changes. The Express service currently does not serve the client build itself.

The credit badge reports credits spent by this browser session. The current `/auth/me` response only includes `creditTotal`; it does not return the account's persisted `creditsUsed` value, so the client does not present an invented account balance.
