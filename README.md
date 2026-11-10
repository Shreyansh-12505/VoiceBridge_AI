# VoiceBridge AI

VoiceBridge AI is a speech translation studio for recording uploads and live speech. The React app talks to an Express API, which stores user and job data in MongoDB and connects to the Vachana/Gnani speech services for transcription and text-to-speech.

> The project was initially planned in Python. The backend was implemented in Node.js to use its asynchronous I/O model for concurrent API requests, MongoDB operations, external speech-service calls, and real-time WebSocket audio streaming.

## Features

- Create an account, sign in, and manage a session with JWT authentication.
- Transcribe uploaded audio, including batch transcription jobs.
- Generate speech from text and stream generated audio.
- Translate an uploaded voice clip through the speech pipeline.
- Transcribe microphone audio in real time over WebSockets.
- Track processing jobs, API usage, and account credits in MongoDB.
- Browse supported voices and languages.

## Tech stack

| Area | Technologies |
| --- | --- |
| Frontend | React 18, Vite, Tailwind CSS, lucide-react |
| Backend | Node.js, Express 5, WebSocket (`ws`) |
| Database | MongoDB with Mongoose |
| Authentication | JWT, HTTP-only cookies, bcrypt |
| Speech services | Vachana/Gnani STT and TTS APIs |

## Project layout

```text
VoiceBridge_AI/
├── client/                 # React + Vite frontend
│   └── src/
├── server/                 # Express API and WebSocket server
│   ├── src/
│   │   ├── db/             # MongoDB connection
│   │   ├── middleware/     # Authentication and credit checks
│   │   ├── models/         # Mongoose models
│   │   ├── realtime/       # Live STT WebSocket bridge
│   │   └── routes/         # Auth and speech API routes
│   └── server.js
└── .env.example
```

## Requirements

- Node.js 20 or newer and npm.
- A MongoDB database, local or hosted.
- A Gnani/Vachana API key for speech processing.

## Run locally

### 1. Configure the backend

Create `server/.env` from the example file:

```sh
cd server
cp ../.env.example .env
```

On Windows PowerShell, use `Copy-Item ..\.env.example .env` instead of `cp`.

Set the values in `server/.env`:

| Variable | Purpose |
| --- | --- |
| `PORT` | API port; defaults to `3000` |
| `NODE_ENV` | Set to `development` locally and `production` when deployed |
| `FRONTEND_ORIGIN` | Included in the example environment; the current CORS middleware does not read it |
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Long, private signing secret for login tokens |
| `GNANI_API_KEY_ID` | API key ID used by the speech services |

Install dependencies and start the API:

```sh
npm install
npm run dev
```

The API listens on `http://localhost:3000` by default. Its health endpoint is `GET /`.

### 2. Start the frontend

Open a second terminal:

```sh
cd client
npm install
npm run dev
```

Open the Vite URL shown in the terminal, usually `http://localhost:5173`. The Vite development server proxies `/auth` and `/speech` requests, including WebSocket upgrades, to `http://localhost:3000` by default. Set `VITE_PROXY_TARGET` if the backend is listening elsewhere.

## Build the frontend

```sh
cd client
npm run build
```

Vite writes the production build to `client/dist`. The Express server does not serve this directory. Deploy the static frontend separately, or configure a web server to serve `client/dist` and proxy `/auth/*`, `/speech/*`, and WebSocket upgrades for `/speech/realtime` to the API.

For a separate frontend and API origin, set these frontend build variables:

```env
VITE_API_BASE_URL=https://your-api.example.com
VITE_WS_BASE_URL=wss://your-api.example.com
```

For a same-origin deployment, leave them unset and route API and WebSocket traffic through the same public host. Never put the MongoDB URI, JWT secret, or Gnani/Vachana key in a `VITE_*` variable; frontend build variables are visible to browsers.

## API overview

All routes below are relative to the API origin.

| Method | Route | Authentication | Purpose |
| --- | --- | --- | --- |
| `GET` | `/` | No | Health check |
| `POST` | `/auth/register` | No | Create an account |
| `POST` | `/auth/login` | No | Sign in |
| `GET` | `/auth/me` | Yes | Get the current account |
| `POST` | `/auth/logout` | No | Clear the auth cookie |
| `GET` | `/speech/voices?model=timbre-v3.0` | No | List available voices and languages |
| `POST` | `/speech/stt` | Yes | Transcribe an uploaded audio file (`audio` form field) |
| `POST` | `/speech/stt/batch` | Yes | Start a batch transcription job |
| `GET` | `/speech/stt/batch/:id` | Yes | Check a batch job and retrieve its transcript |
| `POST` | `/speech/tts` | Yes | Generate speech audio from text |
| `POST` | `/speech/tts/stream` | Yes | Stream generated speech |
| `POST` | `/speech/translate_voice` | Yes | Transcribe and translate an uploaded audio file |
| WebSocket | `/speech/realtime` | Yes | Stream microphone audio for live transcription |

Auth endpoints return JSON. Sign-in and registration also set an HTTP-only `token` cookie and return a JWT for clients that send bearer authentication. The frontend uses the returned token for protected API calls and real-time WebSocket connections. Speech processing routes check the account's available credits.

Audio uploads use `multipart/form-data` with a field named `audio`. The server enforces a 10 MB upload limit and accepts WAV, MP3, OGG, FLAC, AAC, and M4A files for standard transcription.

## Deployment notes

- Configure the backend service with the environment variables above and a start command of `npm start` from the `server` directory.
- Configure the frontend as a static site from the `client` directory, with `npm run build` as the build command and `dist` as the publish directory.
- Set the frontend API and WebSocket URLs to the deployed backend when the two services use different origins.
- If the frontend and backend use different origins, configure CORS and cookie settings to support credentialed requests. The current API reflects request origins (`origin: true`); restrict this to trusted frontend origins before using it for a public production deployment. HTTPS is required for secure cross-site cookies.
- Keep all secrets in the hosting provider's environment settings. Do not commit `.env` files or credentials.

## License

No license is currently specified. Add a `LICENSE` file before reusing or redistributing this project.
