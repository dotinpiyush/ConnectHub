# ConnectHub — Real-Time Chat & Collaboration App (MERN + Socket.io)

**Author:** Piyush Kumar Badhan · [github.com/dotinpiyush](https://github.com/dotinpiyush)

A full-stack MERN application for real-time one-to-one messaging, built as a resume/portfolio project.
Demonstrates: REST API design, JWT authentication, MongoDB schema design, and real-time
communication with Socket.io.

## Clone
```bash
git clone https://github.com/dotinpiyush/ConnectHub.git
cd ConnectHub
```

## Tech Stack
- **Frontend:** React.js, React Router, Axios, Socket.io-client
- **Backend:** Node.js, Express.js, Socket.io
- **Database:** MongoDB with Mongoose
- **Auth:** JWT (JSON Web Tokens), bcrypt password hashing

## Features
- User registration & login with hashed passwords and JWT auth
- Real-time messaging between users via WebSockets (Socket.io)
- Live typing indicators
- Online/offline presence tracking
- Persisted chat history in MongoDB
- Protected frontend routes (redirect to login if not authenticated)

## Folder Structure
```
ConnectHub/
├── backend/
│   ├── config/db.js          # MongoDB connection
│   ├── models/                # User, Room, Message schemas
│   ├── routes/                # auth & chat REST routes
│   ├── middleware/authMiddleware.js
│   ├── server.js              # Express + Socket.io entry point
│   └── package.json
└── frontend/
    ├── src/
    │   ├── context/AuthContext.js
    │   ├── pages/ (Login, Register, Chat)
    │   ├── components/ProtectedRoute.js
    │   ├── App.js
    │   └── index.js
    └── package.json
```

## Setup

### 1. Backend
```bash
cd backend
npm install
cp .env.example .env      # then fill in MONGO_URI and JWT_SECRET
npm run dev                # starts on http://localhost:5000
```

You need a MongoDB instance — either install MongoDB locally or use a free
[MongoDB Atlas](https://www.mongodb.com/atlas) cluster and paste its connection string
into `MONGO_URI`.

### 2. Frontend
```bash
cd frontend
npm install
cp .env.example .env
npm start                  # starts on http://localhost:3000
```

### 3. Try it out
Open two browser windows (or one normal + one incognito), register two different
users, log in as both, and start chatting — messages appear instantly in both windows.

## API Endpoints
| Method | Route                          | Description               |
|--------|--------------------------------|----------------------------|
| POST   | /api/auth/register             | Create a new account       |
| POST   | /api/auth/login                | Log in, get JWT            |
| GET    | /api/auth/me                   | Get current user (protected) |
| GET    | /api/chat/users                | List other users           |
| POST   | /api/chat/rooms                | Create/find a 1-to-1 room  |
| GET    | /api/chat/rooms                | List my rooms              |
| GET    | /api/chat/rooms/:roomId/messages | Get chat history for a room |

## Possible Extensions (good talking points in interviews)
- Group chat rooms
- Message read receipts
- File/image sharing
- Push notifications
- Deploy backend to Render/Railway and frontend to Netlify/Vercel

## Deployment Notes
- Set `CLIENT_URL` in backend `.env` to your deployed frontend URL for CORS
- Set `REACT_APP_API_URL` / `REACT_APP_SOCKET_URL` in frontend `.env` to your deployed backend URL

## Advanced Deployment: Docker & Kubernetes

### Run locally with Docker Compose
Spins up MongoDB, backend, and frontend (served via nginx) as three containers with one command:
```bash
JWT_SECRET=your_secret docker-compose up --build
```
- Frontend: http://localhost:3000
- Backend: http://localhost:5000

### Kubernetes (production-style deployment)
The `k8s/` folder contains manifests for a full cluster deployment:

| File | Purpose |
|------|---------|
| `00-namespace.yaml` | Isolated `connecthub` namespace |
| `01-config.yaml` | ConfigMap (non-secret env vars) + Secret (JWT_SECRET) |
| `02-mongo.yaml` | MongoDB as a `StatefulSet` with a `PersistentVolumeClaim` (data survives pod restarts) |
| `03-backend.yaml` | Backend `Deployment` (2 replicas) + `Service`, with readiness/liveness probes and CPU/memory limits |
| `04-frontend-ingress.yaml` | Frontend `Deployment`/`Service` (nginx-served build) + `Ingress` routing `/api` → backend, `/` → frontend |
| `05-hpa.yaml` | `HorizontalPodAutoscaler` — scales backend pods 2→6 automatically based on CPU load |

Build and push images, then apply:
```bash
docker build -t dotinpiyush/connecthub-backend:latest ./backend
docker build -t dotinpiyush/connecthub-frontend:latest ./frontend
docker push dotinpiyush/connecthub-backend:latest
docker push dotinpiyush/connecthub-frontend:latest

kubectl apply -f k8s/
kubectl get pods -n connecthub
```

**CI/CD:** `.github/workflows/deploy.yml` automates this — on every push to `main`, GitHub Actions builds both Docker images, pushes them to Docker Hub, then applies the manifests and does a rolling restart on the cluster. Needs `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`, and `KUBE_CONFIG` (base64-encoded kubeconfig) as repo secrets.

**Known limitation / interview talking point:** Socket.io needs a shared pub/sub layer (e.g., the Redis adapter, `@socket.io/redis-adapter`) once you run more than one backend replica — otherwise a message from a client connected to pod A won't reach a client connected to pod B. The current manifests run 2 backend replicas without this, which is a good discussion point on real-time app scaling and a natural "next step" to mention in an interview.
