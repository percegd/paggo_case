# Paggo.ai - Intelligent Document Analysis

Paggo is a powerful, full-stack application designed to revolutionize how financial teams interact with their documents. By leveraging advanced OCR (Optical Character Recognition) and the latest in Generative AI (Google Gemini), Paggo transforms static PDFs and images into dynamic, interactive data sources.

![Paggo Dashboard](https://via.placeholder.com/800x400?text=Paggo+Dashboard+Placeholder)

## 🚀 Key Features

*   **📄 Smart Document Upload:** Support for PDF and Image files (PNG, JPG) with real-time upload progress.
*   **🔍 Advanced OCR:** Automatically extracts text from uploaded documents using Tesseract.js.
*   **🤖 AI-Powered Analysis:**
    *   **Summarization:** Instantly generates concise summaries of financial documents using Google Gemini.
    *   **Interactive Chat:** Ask questions about your document's content in natural language.
*   **📊 PDF Reporting:** Generate professional downloadable PDF reports that include the original file, extracted text, AI summary, and your chat history.
*   **🔐 Secure & Scalable:**
    *   **Authentication:** Robust user authentication via Supabase (Google OAuth).
    *   **Storage:** Secure document storage in Supabase Buckets.
    *   **Database:** Relational data management with PostgreSQL and Prisma.

## 🛠️ Tech Stack

### Frontend (`/frontend`)
*   **Framework:** [Next.js 14](https://nextjs.org/) (App Router)
*   **Language:** TypeScript
*   **Styling:** Tailwind CSS
*   **State Management:** React Context API
*   **PDF Generation:** `jspdf`, `pdf-lib`
*   **Icons:** Lucide React

### Backend (`/backend`)
*   **Framework:** [NestJS](https://nestjs.com/)
*   **Language:** TypeScript
*   **Database ORM:** [Prisma](https://www.prisma.io/)
*   **AI Engine:** Google Generative AI (Gemini Pro)
*   **OCR Engine:** `tesseract.js`
*   **File Parsing:** `pdf-parse`

### Infrastructure
*   **Database:** PostgreSQL (via Supabase or Local)
*   **Auth & Storage:** [Supabase](https://supabase.com/)
*   **Deployment:** Vercel (Frontend), Render (Backend)

## ⚙️ Prerequisites

*   **Node.js** (v18 or higher)
*   **npm** or **yarn**
*   **Git**
*   **Supabase Account** (for Auth, DB, and Storage)
*   **Google AI Studio Key** (for Gemini API)

## 🚀 Getting Started

Follow these steps to set up the project locally. For a more detailed guide, see [`SETUP.md`](./SETUP.md).

### 1. Backend Setup

1.  Navigate to the backend folder:
    ```bash
    cd backend
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Configure environment variables:
    ```bash
    cp .env.example .env
    ```
    Update `.env` with your `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_KEY`, and `GEMINI_API_KEY`.
4.  Sync database schema:
    ```bash
    npx prisma db push
    ```
5.  Start the server:
    ```bash
    npm run start:dev
    ```
    *Server runs on port 3001.*

### 2. Frontend Setup

1.  Navigate to the frontend folder:
    ```bash
    cd frontend
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Configure environment variables:
    ```bash
    cp .env.local.example .env.local
    ```
    Update `.env.local` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `BACKEND_URL` (default: `http://localhost:3001`).
4.  Start the development server:
    ```bash
    npm run dev
    ```
    *App runs on port 3000.*

> **Important:** Keep the frontend running on port `3000` to ensure Google OAuth compatibility.

## 📦 Environment Variables

### Backend (`backend/.env`)
| Variable | Description |
| :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string (Transaction Mode) |
| `SUPABASE_URL` | Your project URL from Supabase |
| `SUPABASE_KEY` | Supabase `service_role` key (for backend privileges) |
| `GEMINI_API_KEY` | API Key from Google AI Studio |
| `PORT` | Application port (default: 3001) |

### Frontend (`frontend/.env.local`)
| Variable | Description |
| :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Your project URL from Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase `anon` key (public) |
| `BACKEND_URL` | URL of the backend API (e.g., `http://localhost:3001` or production URL) |

## 🤝 Contributing

Contributions are welcome! Please fork the repository and submit a pull request for any enhancements.

## 📄 License

This project is licensed under the MIT License.
