<div align="center">

<img src="./public/favicon-dark.svg" alt="ForkSpace Logo" width="96" height="96" />

# ForkSpace

### Shared coding rooms for interview practice and DSA mentoring.

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-43853d?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=white)](https://react.dev/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.x-white?logo=socket.io&logoColor=black)](https://socket.io/)
[![Status](https://img.shields.io/badge/Status-Active-brightgreen.svg)]()

**[Quick Start](#quick-start)** | **[Features](#features)** | **[Architecture](#architecture)** | **[License](#license)**

</div>

---

## What is ForkSpace?

ForkSpace is a realtime shared coding room built for:

- mock interviews
- peer DSA practice
- mentor-led problem solving

Instead of screen sharing, switching tabs, and testing code in separate places, two people can stay in one room, edit the same solution, run it, and compare output together.

The product is currently strongest for Codeforces-style practice and general interview-prep sessions.

---

## Features

### Shared Practice Room

- Realtime code sync with Socket.IO
- Room-based collaboration with a shareable room ID
- Live participant list and room presence
- Session modes: `Peer Practice`, `Mock Interview`, `Mentoring`
- Driver / Navigator role assignment for structured pair coding

### Problem-Solving Workflow

- Shared problem brief in the sidebar
- Manual sample input and expected output fields for practical DSA sessions
- Codeforces-first workflow with problem URL / platform / code context
- Clear output comparison with visible `Passed sample` / `Mismatch` feedback
- Shared approach notes for discussing brute force, optimized ideas, and edge cases

### Code Execution

- Run code in:
  - C++
  - Python
  - JavaScript
- Execution status with visible time and memory
- Formatter support for cleaner code before review or reruns
- Output panel designed for quick debugging during pair sessions

### AI Assistance

- AI code hints inside the editor
- `Review Solution` flow for bug risks, complexity, and style feedback
- Provider fallback support across:
  - Groq
  - Gemini
  - Mistral Codestral
- Graceful fallback when AI providers fail

### Auth And Persistence

- Continue as guest for fast room entry
- Sign in / create account flow
- Signed-in users can keep room and run history
- Room state persistence survives refresh and backend restart

---

## Current Product Direction

ForkSpace is not trying to be a full IDE or another generic online compiler.

It is focused on one narrower workflow:

1. Enter as guest or sign in
2. Join a shared room
3. Discuss the problem in one place
4. Edit one solution together
5. Run and compare output immediately

That makes it especially useful for:

- pair programming during DSA prep
- mentor / learner sessions
- mock interviewer / candidate sessions

---

## Architecture

```text
Client (React + CodeMirror)
        |
        |  WebSocket (Socket.IO)
        v
Express + Socket Server
        |
        |-- Room state persistence
        |   (room-state.json)
        |
        |-- Auth / history
        |   (JWT + MongoDB)
        |
        |-- AI providers
        |   (Groq / Gemini / Mistral)
        |
        `-- Judge0 API
            (sandboxed code execution)
```

### Notes

- Socket.IO powers realtime room sync
- Judge0 handles code execution
- Room state is persisted locally in `server/data/room-state.json`
- Auth and saved history currently use JWT plus MongoDB-backed user storage
- Redis pub/sub support exists in the backend for horizontal scaling when configured

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, Tailwind CSS, Vite |
| Editor | CodeMirror |
| Realtime | Socket.IO |
| Backend | Node.js, Express |
| Auth | JWT, bcryptjs, MongoDB / Mongoose |
| AI | Groq, Gemini, Mistral |
| Execution | Judge0 |
| Optional scaling | Redis adapter for Socket.IO |

---

## Quick Start

### Prerequisites

- Node.js 18+
- npm
- MongoDB if you want sign-in and saved history
- A Judge0 RapidAPI key for code execution
- At least one AI provider key if you want AI hints / review

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Root `.env`:

```env
VITE_SERVER_URL=http://localhost:5000
```

`server/.env`:

```env
PORT=5000
CLIENT_URL=http://localhost:5173

APP_NAME=ForkSpace
APP_URL=http://localhost:5173

JUDGE0_API_URL=https://judge0-ce.p.rapidapi.com
JUDGE0_API_KEY=your_judge0_key_here

GROQ_API_KEY=your_groq_key_here
GEMINI_API_KEY=your_gemini_key_here
MISTRAL_API_KEY=your_mistral_key_here

JWT_SECRET=replace_this_with_a_real_secret
MONGODB_URI=mongodb://localhost:27017/forkspace

# Optional
REDIS_URL=redis://localhost:6379
```

### 3. Start the backend

```bash
npm run dev:server
```

### 4. Start the frontend

```bash
npm run dev:client
```

### 5. Open the app

```text
http://localhost:5173
```

---

## How To Use It Well

Recommended workflow for the current product:

1. Choose `Continue as Guest` for fast sessions, or sign in if you want saved rooms and runs.
2. Create or enter a room ID.
3. Add the problem context and shared sample input / expected output.
4. Solve together in the shared editor.
5. Run once and use the mismatch view to discuss what needs to change.

For now, this manual sample-based workflow is more reliable than trying to automate every external problem platform.

---

## Project Structure

```text
ForkSpace/
|-- src/
|   |-- components/
|   |   |-- Workspace/
|   |   |-- common/
|   |   |-- forms/
|   |   `-- sidebar/
|   |-- lib/
|   |-- pages/
|   `-- socket.js
|-- server/
|   |-- data/
|   |-- models/
|   |-- ai-server.js
|   `-- server.js
|-- public/
|-- nodemon.json
`-- README.md
```

---

## Known Product Boundaries

ForkSpace currently does not try to be:

- a full multi-file IDE
- a LeetCode-native execution environment
- a video-call platform
- a generic "online compiler clone"

It is intentionally narrower: shared coding rooms for problem-solving sessions.

---

## Roadmap

- [x] Realtime shared rooms
- [x] Driver / Navigator session roles
- [x] Multi-language execution for C++, Python, and JavaScript
- [x] Sample output comparison
- [x] AI hints and review flow
- [x] Guest entry plus sign-in flow
- [x] Room persistence across restart
- [ ] Stronger room history UI
- [ ] More structured mentoring notes
- [ ] Better problem import workflow
- [ ] Deeper run/result history inside each room

---

## License

MIT - see [LICENSE](LICENSE) for details.

---

<div align="center">
  <strong>ForkSpace is being shaped around practical interview practice and DSA mentoring workflows.</strong>
</div>
