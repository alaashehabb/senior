# Repository Analysis: `alaashehabb/senior`

## 1) Project purpose

This repository implements a sign-language-assisted chat application composed of a web frontend, a Node.js backend API, and a Python model service.

- The product framing is visible in the landing page text: “SLR Chat App” and “Sign language letters and words assistant with realtime chat” (`/home/runner/work/senior/senior/frontend/src/pages/LandingPage.jsx:46-48`).
- The backend exposes APIs for auth, users, and prediction (`/home/runner/work/senior/senior/backend-api/src/app.js:18-21`).
- A dedicated model service exposes `/predict` and `/health` (`/home/runner/work/senior/senior/model-services/app.py:12-17`, `/home/runner/work/senior/senior/model-services/app.py:26-45`).
- Data model supports users, chat rooms, memberships, and messages (`/home/runner/work/senior/senior/backend-api/prisma/schema.prisma:15-66`).

The only README in the repo is a default Vite template and does not document this architecture (`/home/runner/work/senior/senior/frontend/README.md:1-17`).

## 2) Major components

### Frontend (`/home/runner/work/senior/senior/frontend`)
- React SPA entry and routing (`/home/runner/work/senior/senior/frontend/src/main.jsx:7-13`, `/home/runner/work/senior/senior/frontend/src/App.jsx:10-21`).
- Auth context/state and token lifecycle (`/home/runner/work/senior/senior/frontend/src/context/AuthContext.jsx:6-50`).
- Protected route gate for authenticated app area (`/home/runner/work/senior/senior/frontend/src/components/ProtectedRoute.jsx:4-16`).
- Main app page with camera-based translation action and chat UI (`/home/runner/work/senior/senior/frontend/src/pages/AppHomePage.jsx:6-368`).
- API client configuration and auth header injection (`/home/runner/work/senior/senior/frontend/src/services/api.js:3-13`).

### Backend API (`/home/runner/work/senior/senior/backend-api`)
- Express app middleware and route registration (`/home/runner/work/senior/senior/backend-api/src/app.js:13-21`).
- HTTP server + Socket.IO server bootstrap (`/home/runner/work/senior/senior/backend-api/src/server.js:14-22`, `/home/runner/work/senior/senior/backend-api/src/server.js:60-62`).
- Auth endpoints and logic (`/home/runner/work/senior/senior/backend-api/src/routes/auth.routes.js:5-7`, `/home/runner/work/senior/senior/backend-api/src/controllers/auth.controller.js:14-90`).
- User listing endpoint for chat partner selection (`/home/runner/work/senior/senior/backend-api/src/routes/users.routes.js:5`, `/home/runner/work/senior/senior/backend-api/src/controllers/users.controller.js:3-28`).
- Prediction endpoint that forwards to model service with fallback behavior (`/home/runner/work/senior/senior/backend-api/src/routes/predict.routes.js:5`, `/home/runner/work/senior/senior/backend-api/src/controllers/predict.controller.js:11-37`).
- Chat socket handlers for room join and message send/receive (`/home/runner/work/senior/senior/backend-api/src/sockets/chat.socket.js:43-132`).
- Prisma client and database schema (`/home/runner/work/senior/senior/backend-api/src/lib/prisma.js:1-5`, `/home/runner/work/senior/senior/backend-api/prisma/schema.prisma:15-66`).

### Model service (`/home/runner/work/senior/senior/model-services`)
- FastAPI app with mock prediction output (`/home/runner/work/senior/senior/model-services/app.py:9-45`).

## 3) Primary languages/frameworks and build tooling

### Languages and frameworks
- JavaScript/JSX for frontend and backend.
- Python for model service.
- SQL + Prisma schema for persistence.

Key framework/library evidence:
- Frontend: React, React Router, Vite, Axios, Socket.IO client (`/home/runner/work/senior/senior/frontend/package.json:6-21`).
- Backend: Express, Prisma, Socket.IO, JWT, bcrypt, Helmet, Morgan (`/home/runner/work/senior/senior/backend-api/package.json:15-26`).
- Model service: FastAPI + Pydantic (`/home/runner/work/senior/senior/model-services/app.py:1-2`, `/home/runner/work/senior/senior/model-services/app.py:9`).

### Tooling
- Package manager: npm (lockfiles at root/frontend/backend).
- Frontend scripts: `dev`, `build`, `lint`, `preview` (`/home/runner/work/senior/senior/frontend/package.json:6-10`).
- Backend scripts: `dev`, `start`, placeholder `test` (`/home/runner/work/senior/senior/backend-api/package.json:6-10`).
- Frontend lint config present (`/home/runner/work/senior/senior/frontend/eslint.config.js:7-21`).
- No repository-wide orchestrator scripts in root package (`/home/runner/work/senior/senior/package.json:1-7`).

## 4) Runtime architecture and request/data flow (main user path)

### Entry points
- Frontend entrypoint mounts `App` under `BrowserRouter` (`/home/runner/work/senior/senior/frontend/src/main.jsx:7-13`).
- Backend entrypoint initializes Express and Socket.IO (`/home/runner/work/senior/senior/backend-api/src/server.js:14-22`).

### HTTP route map
- `/health`, `/auth`, `/predict`, `/users` are mounted in Express (`/home/runner/work/senior/senior/backend-api/src/app.js:18-21`).
- Auth endpoints: `/auth/register`, `/auth/login`, `/auth/me` (`/home/runner/work/senior/senior/backend-api/src/routes/auth.routes.js:5-7`).

### Main user flow
1. User lands on `/`, logs in/registers (`/home/runner/work/senior/senior/frontend/src/pages/LandingPage.jsx:25-35`).
2. Frontend stores JWT in `localStorage` (`/home/runner/work/senior/senior/frontend/src/context/AuthContext.jsx:33-40`).
3. Protected route permits `/app` only when authenticated (`/home/runner/work/senior/senior/frontend/src/components/ProtectedRoute.jsx:5-13`).
4. Frontend loads chat candidates via `GET /users` (`/home/runner/work/senior/senior/frontend/src/pages/AppHomePage.jsx:131-142`).
5. Frontend opens Socket.IO connection with token in handshake auth (`/home/runner/work/senior/senior/frontend/src/pages/AppHomePage.jsx:145-149`).
6. Backend socket middleware verifies JWT and attaches user (`/home/runner/work/senior/senior/backend-api/src/server.js:23-45`).
7. User joins/creates direct room via `chat:join`; backend returns recent messages (`/home/runner/work/senior/senior/backend-api/src/sockets/chat.socket.js:44-85`).
8. User sends message via `chat:send`; backend persists and broadcasts `chat:receive` (`/home/runner/work/senior/senior/backend-api/src/sockets/chat.socket.js:91-126`).

### Prediction flow
- Frontend captures webcam frame and posts `/predict` (`/home/runner/work/senior/senior/frontend/src/pages/AppHomePage.jsx:54-78`).
- Backend forwards to model service and returns model response if available (`/home/runner/work/senior/senior/backend-api/src/controllers/predict.controller.js:14-27`).
- On model-service failure, backend returns synthetic fallback prediction (`/home/runner/work/senior/senior/backend-api/src/controllers/predict.controller.js:29-36`).

### Persistence and data model
- Prisma with SQLite datasource (`/home/runner/work/senior/senior/backend-api/prisma/schema.prisma:10-13`, `/home/runner/work/senior/senior/backend-api/prisma/migrations/migration_lock.toml:3`).
- Entities: `User`, `Room`, `RoomMember`, `Message` (`/home/runner/work/senior/senior/backend-api/prisma/schema.prisma:15-55`).
- Migration confirms relational constraints and indexes (`/home/runner/work/senior/senior/backend-api/prisma/migrations/20260508085321_init_auth_chat/migration.sql:2-46`).

## 5) Configuration, deployment, and local run

### Configuration
Backend environment variables:
- `PORT` (`/home/runner/work/senior/senior/backend-api/src/server.js:11`).
- `CLIENT_ORIGIN` for Socket.IO CORS (`/home/runner/work/senior/senior/backend-api/src/server.js:12`, `/home/runner/work/senior/senior/backend-api/src/server.js:18`).
- `JWT_SECRET` required for token sign/verify (`/home/runner/work/senior/senior/backend-api/src/utils/jwt.js:4-20`).
- `MODEL_SERVICE_URL` for prediction forwarding (`/home/runner/work/senior/senior/backend-api/src/controllers/predict.controller.js:11`).
- `DATABASE_URL` for Prisma datasource (`/home/runner/work/senior/senior/backend-api/prisma/schema.prisma:12`, `/home/runner/work/senior/senior/backend-api/prisma.config.ts:11-13`).

Env files are intentionally ignored by git (`/home/runner/work/senior/senior/.gitignore:6-10`, `/home/runner/work/senior/senior/backend-api/.gitignore:2-4`).

### Deployment/CI/hosting
- No CI workflow files detected in `.github`.
- No Docker/Compose or common hosting manifests detected (Dockerfile/compose/Procfile/vercel/render/etc.).

### Local run (inferred)
1. Install dependencies in each Node package (`/home/runner/work/senior/senior`, `/home/runner/work/senior/senior/frontend`, `/home/runner/work/senior/senior/backend-api`).
2. Start backend: `npm run dev` in `backend-api` (`/home/runner/work/senior/senior/backend-api/package.json:7`).
3. Start frontend: `npm run dev` in `frontend` (`/home/runner/work/senior/senior/frontend/package.json:7`).
4. Run model service separately (FastAPI app at `/home/runner/work/senior/senior/model-services/app.py`).

## 6) Notable patterns and security considerations

### Patterns
- JWT bearer auth is used for both REST middleware and socket auth (`/home/runner/work/senior/senior/backend-api/src/middleware/auth.middleware.js:6-27`, `/home/runner/work/senior/senior/backend-api/src/server.js:25-34`).
- Frontend auth state is centralized with React Context (`/home/runner/work/senior/senior/frontend/src/context/AuthContext.jsx:4-50`).
- Realtime messaging uses room-based Socket.IO events with DB-backed history (`/home/runner/work/senior/senior/backend-api/src/sockets/chat.socket.js:63-83`, `/home/runner/work/senior/senior/backend-api/src/sockets/chat.socket.js:125-126`).
- Basic structured error responses are returned from controllers (`/home/runner/work/senior/senior/backend-api/src/controllers/auth.controller.js:21-79`, `/home/runner/work/senior/senior/backend-api/src/controllers/users.controller.js:21-23`).

### Security observations
- Positive controls: password hashing via bcrypt (`/home/runner/work/senior/senior/backend-api/src/controllers/auth.controller.js:35`, `/home/runner/work/senior/senior/backend-api/src/controllers/auth.controller.js:69`), Helmet middleware enabled (`/home/runner/work/senior/senior/backend-api/src/app.js:13`), membership checks before room actions (`/home/runner/work/senior/senior/backend-api/src/sockets/chat.socket.js:58-61`, `/home/runner/work/senior/senior/backend-api/src/sockets/chat.socket.js:99-102`).
- Risks/considerations:
  - JWT stored in `localStorage` (XSS token theft risk) (`/home/runner/work/senior/senior/frontend/src/context/AuthContext.jsx:11`, `/home/runner/work/senior/senior/frontend/src/context/AuthContext.jsx:34`).
  - Socket CORS defaults to `*` if `CLIENT_ORIGIN` is unset (`/home/runner/work/senior/senior/backend-api/src/server.js:12`, `/home/runner/work/senior/senior/backend-api/src/server.js:18`).
  - No visible rate limiting on auth endpoints.

## 7) Known limitations / TODOs

- Frontend prediction payload sends `imageBase64` while backend expects `language`, `mode`, and `landmarks`; this appears mismatched (`/home/runner/work/senior/senior/frontend/src/pages/AppHomePage.jsx:77`, `/home/runner/work/senior/senior/backend-api/src/controllers/predict.controller.js:3-8`).
- Educational module is a placeholder (“will be added in the next steps”) (`/home/runner/work/senior/senior/frontend/src/pages/AppHomePage.jsx:359-360`).
- Model service currently returns mock prediction output, not learned inference (`/home/runner/work/senior/senior/model-services/app.py:34-45`).
- Backend test script is a placeholder that exits with error (`/home/runner/work/senior/senior/backend-api/package.json:9`).

## Additional validation notes (baseline checks)

While preparing this report, repository checks were run:
- Frontend lint currently fails on existing issues unrelated to this document change (`/home/runner/work/senior/senior/frontend/src/context/AuthContext.jsx:13`, `/home/runner/work/senior/senior/frontend/src/context/AuthContext.jsx:53`, `/home/runner/work/senior/senior/frontend/src/pages/AppHomePage.jsx:49`).
