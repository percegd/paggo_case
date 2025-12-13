
# Paggo - Setup & Local Development Guide

This guide explains how to set up the **Paggo** solution locally. The project consists of a **NestJS Backend** and a **Next.js Frontend**.

## Prerequisites

- Node.js (v18+)
- PostgreSQL (Local or via Docker/Supabase)
- Git

---

## 1. Backend Setup (`/backend`)

The backend handles the API, database connection (Prisma), and AI integration.

1.  **Navigate to the backend directory:**
    ```bash
    cd backend
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Configure Environment Variables:**
    - Copy the example environment file:
      ```bash
      cp .env.example .env
      ```
    - Open `.env` and fill in your values:
        - `DATABASE_URL`: Connection string for your PostgreSQL database.
        - `SUPABASE_URL` / `SUPABASE_KEY`: Your Supabase credentials.
        - `GEMINI_API_KEY`: API Key for Google Gemini AI.

4.  **Database Migration:**
    Push the schema to your database:
    ```bash
    npx prisma db push
    ```

5.  **Run the Backend:**
    ```bash
    npm run start:dev
    ```
    The server will start on `http://localhost:3001`.

---

## 2. Frontend Setup (`/frontend`)

The frontend is a Next.js application that proxies API requests to the backend.

1.  **Navigate to the frontend directory:**
    ```bash
    cd frontend
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Configure Environment Variables:**
    - Copy the example environment file:
      ```bash
      cp .env.local.example .env.local
      ```
    - Open `.env.local` and fill in your values:
        - `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase URL.
        - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase Anon Key.
        - `BACKEND_URL`: `http://localhost:3001` (Use this default for local dev).

4.  **Run the Frontend:**
    ```bash
    npm run dev
    ```
    The application will start on `http://localhost:3000`.

    > [!WARNING]
    > **Google OAuth Restriction**: Do NOT change the port from `3000`. The Google OAuth configuration is restricted to `http://localhost:3000`. Changing the port will break the login functionality.

---

## 3. Running the Full Stack

1.  Ensure **PostgreSQL** is running.
2.  Start **Backend**: `cd backend && npm run start:dev`
3.  Start **Frontend**: `cd frontend && npm run dev`
4.  Open your browser at `http://localhost:3000`.

## Architecture Note

The frontend uses **Next.js Rewrites** to proxy API calls:
- Calls to `/api/*` in the frontend are forwarded to `${BACKEND_URL}/*`.
- If `BACKEND_URL` is not set (e.g., in Vercel), it defaults to the production Render URL (`https://paggo-case-o4s3.onrender.com`).
- This avoids CORS issues and simplifies configuration.
