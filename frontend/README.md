# Frontend

React/TypeScript frontend for the 75 Hard Challenge Tracker.

## Tech Stack

- **Framework**: [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Routing**: [React Router v6](https://reactrouter.com/)
- **HTTP Client**: [Axios](https://axios-http.com/)
- **Container**: Docker (nginx) → Cloud Storage + HTTPS Load Balancer

## Folder Structure

```
frontend/
├── src/
│   ├── App.tsx          # Root component and routing
│   ├── main.tsx         # React DOM entry point
│   ├── index.css        # Tailwind directives
│   ├── components/      # Reusable UI components
│   ├── pages/           # Route-level page components
│   ├── hooks/           # Custom React hooks
│   ├── services/        # API client wrappers
│   └── types/           # TypeScript type definitions
├── public/              # Static assets
├── .env.example         # Environment variable template
├── Dockerfile           # Production image (nginx)
├── index.html           # HTML entry point
├── nginx.conf           # nginx config for SPA routing
├── package.json         # npm dependencies
├── tailwind.config.js   # Tailwind configuration
├── tsconfig.json        # TypeScript configuration
└── vite.config.ts       # Vite configuration
```

## Local Development

```bash
# Install dependencies
npm install

# Copy and configure environment variables
cp .env.example .env
# Edit .env with your values

# Start the development server
npm run dev
```

The app will be available at http://localhost:5173.

Requests to `/api/*` are proxied to the backend at `http://localhost:8000`.

## Build

```bash
npm run build        # outputs to dist/
npm run preview      # preview the production build locally
```

## Environment Variables

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend API base URL |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth Client ID |
