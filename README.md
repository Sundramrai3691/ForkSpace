<div align="center">

<img src="./public/favicon-dark.svg" alt="ForkSpace Logo" width="100" height="100" />

# ForkSpace

### A real-time collaborative coding platform — built for developers, by a developer.

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-16%2B-43853d?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=white)](https://reactjs.org/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.x-white?logo=socket.io&logoColor=black)](https://socket.io/)
[![Redis](https://img.shields.io/badge/Redis-pub%2Fsub-dc382d?logo=redis&logoColor=white)](https://redis.io/)
[![Status](https://img.shields.io/badge/Status-Active-brightgreen.svg)]()

**[Live Demo](https://forkspace.studio)** · **[Quick Start](#-quick-start)** · **[Architecture](#-architecture)** · **[Report Bug](https://github.com/Sundramrai3691/ForkSpace/issues)**

</div>

---

## What is ForkSpace?

ForkSpace is an open-source, real-time collaborative code editor built for technical interviews, pair programming, and code reviews. Multiple users join a room, code together with live synchronization, execute code in 10+ languages, and get instant AI-powered code review — all from the browser with no setup required.

---

## Features

### Real-Time Collaboration

- Live code synchronization with sub-50ms latency across all connected users
- **Driver / Navigator Mode**: Explicit pair programming roles with visual badges and a swap button
- **Approach Notes**: Shared real-time block for brainstorming ideas, brute force, and optimized approaches
- **Edge Case Checklist**: Shared room-level checklist for common DSA edge cases (empty input, duplicates, etc.)
- Real-time user presence indicators showing who is active in the session
- Group chat alongside the editor for in-session communication

### AI-Powered Practice

- **Structured AI Review**: Detailed analysis of correctness risks, edge cases, complexity, and readability (Gemini 1.5 Flash / Mistral)
- **Ghost Hints**: Real-time code completion suggestions (Fill-In-the-Middle) as you type
- **Multi-Model Support**: Seamless integration with Google Gemini 1.5 Flash and Mistral Codestral

### Code Execution Engine

- Multi-language execution: C++, Python, Java, JavaScript, Go, Rust, TypeScript, and more
- **Mismatch Debug View**: Smart diffing that highlights the first differing line and provides debugging hints
- Powered by Judge0 — the industry-standard sandboxed code execution API
- **Run History**: Timeline of the last 10 runs with status, time, and memory usage tracking

### Developer Experience

- **Session Modes**: Tailored UI labels for Peer Practice, Mock Interview, and Mentoring modes
- **Private Mentor Notes**: Secure, per-user notes for interviewers/mentors (visible only to the creator)
- CodeMirror editor with syntax highlighting and auto-suggestions
- Dark/light theme toggle with 10+ syntax themes
- Distraction-free, responsive UI that works on all screen sizes

---

## Architecture

```
Client (React + CodeMirror)
        │
        │  WebSocket (Socket.IO)
        ▼
Express Server (Node.js)
        │
        ├── Session Management ─── Persistent State
        │   (rooms, roles,         (room-state.json,
        │    notes, history)        user-state.json)
        │
        ├── AI Integration ─────── Gemini 1.5 Flash
        │   (review, hints)        Mistral Codestral
        │
        └── Judge0 API
            (code execution sandbox)
```

**Key design decisions:**

- **Socket.io** for real-time bidirectional communication (code, roles, notes)
- **Gemini 1.5 Flash** as the primary AI engine for fast, high-quality code reviews and hints
- **Judge0** for sandboxed execution to prevent security risks on the host server
- **Local Persistence**: Room and user states are persisted to JSON files, surviving server restarts

---

## Tech Stack

| Layer      | Technology                                  | Why                                         |
| ---------- | ------------------------------------------- | ------------------------------------------- |
| Frontend   | React 18, Tailwind CSS                      | Fast iteration, modern responsive UI        |
| Editor     | CodeMirror                                  | Flexible, real-time sync friendly           |
| Real-time  | Socket.IO                                   | Reliable bidirectional communication        |
| Backend    | Node.js, Express                            | Non-blocking I/O for real-time workloads    |
| AI Review  | Gemini 1.5 Flash / Mistral                  | Structured code review and FIM hints        |
| Execution  | Judge0 API                                  | Secure sandboxed multi-language execution   |
| Deployment | Vercel (Frontend), Render/Railway (Backend) | Best-in-class hosting for React and Node.js |

---

## Quick Start

### Prerequisites

- Node.js v18+
- npm or yarn
- [Judge0 API key](https://rapidapi.com/judge0-official/api/judge0-ce) (free tier on RapidAPI)
- [Google Gemini API key](https://aistudio.google.com/) (Free tier available) or Mistral API key

### 1. Clone and install

```bash
git clone https://github.com/Sundramrai3691/ForkSpace.git
cd ForkSpace
npm install
```

### 2. Configure environment

Create a `.env` file in the `server/` directory:

```env
PORT=5000
CLIENT_URL=http://localhost:5173

# Judge0
JUDGE0_API_URL=https://judge0-ce.p.rapidapi.com
JUDGE0_API_KEY=your_rapidapi_key_here

# AI (Recommended: Gemini 1.5 Flash)
GEMINI_API_KEY=your_gemini_key_here
MISTRAL_API_KEY=your_mistral_key_here

# App
APP_NAME=ForkSpace
APP_URL=http://localhost:5173
```

### 3. Run development servers

```bash
# Terminal 1 — backend
npm run dev:server

# Terminal 2 — frontend
npm run dev:client
```

---

## Project Structure

```
ForkSpace/
├── src/                    # React frontend
│   ├── components/         # UI components (Workspace, Sidebar, Forms)
│   │   └── Workspace/      # Core editor, AI features, and execution logic
│   ├── pages/              # Route-level components (Editor, Login)
│   └── socket.js           # Socket.io client configuration
├── server/                 # Node.js + Express backend
│   ├── data/               # Persistent JSON state (ignored by git)
│   ├── server.js           # Main socket & API server
│   └── ai-server.js        # Dedicated AI hints server
└── .gitignore              # Excludes node_modules and local state
```

---

## Roadmap

- [X] Driver / Navigator roles
- [X] AI Code Review & Ghost Hints
- [X] Run History & Debug View
- [X] Session Modes (Interview/Mentoring)
- [ ] Multi-cursor presence
- [ ] Video/audio call integration
- [ ] GitHub OAuth login
- [ ] Export session as Gist

## License

MIT — see [LICENSE](LICENSE) for details.

---

<div align="center">
  <strong>Built by <a href="https://github.com/Sundramrai3691">Sundram Kumar Rai</a> · NIT Raipur</strong>
  <br/>
  <em>If this helped you, a ⭐ on GitHub goes a long way.</em>
</div>
