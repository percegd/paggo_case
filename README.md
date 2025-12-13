# 🤖 AI Document Chat - Paggo Case

> A Fullstack application that allows users to upload documents and interact with them using Generative AI (RAG).

## 🚀 Live Demo
Check out the application running in production:
👉 **[https://paggo-case-six.vercel.app](https://paggo-case-six.vercel.app)**

---

## 🛠️ Tech Stack

This project was built using a modern, scalable architecture ensuring separation of concerns and type safety.

**Frontend:**
* **Framework:** React (Next.js 14)
* **Styling:** TailwindCSS
* **Authentication:** Supabase Auth (Google OAuth)
* **HTTP Client:** Axios

**Backend:**
* **Framework:** NestJS (Node.js)
* **Language:** TypeScript
* **Database ORM:** Prisma
* **AI Engine:** Google Generative AI SDK
* **LLM Model:** Google Gemini (gemini-1.5-flash)

**Infrastructure:**
* **Frontend Hosting:** Vercel
* **Backend Hosting:** Render
* **Database & Storage:** Supabase (PostgreSQL + Buckets)

---

## ✨ Key Features

* **🔐 Secure Authentication:** Seamless login via Google OAuth using Supabase.
* **📂 Upload:** Users can upload documents directly to the cloud (Supabase Storage).
* **🧠 Intelligent Context:** The app extracts full text from documents using **OCR (Optical Character Recognition)**, allowing the AI to answer specific questions based on the complete document context.
* **💬 Interactive Chat:** A clean, responsive chat interface to query the documents.

---

## ⚙️ Local Installation

If you want to run this project locally on your machine, please follow the detailed step-by-step guide in the setup document:

👉 **[Read the Installation Guide (SETUP.md)](./SETUP.md)**

---

## 🧩 How it Works (Architecture)

1.  **Upload:** The user uploads a document via the Frontend.
2.  **Storage:** The file is saved in a public Supabase Storage bucket.
3.  **Extraction:** The Backend downloads the file and uses **Tesseract.js (OCR)** to extract all text content from the document.
4.  **Analysis:** When the user asks a question, the full document text is injected directly into the **Gemini** context window.
5.  **Generation:** The AI generates a precise answer based on the provided document text.

---

## 📞 Contact

Developed by **Arthur Cruvinel Marques**.

📧 Email: [arthurcruvinel@usp.br](mailto:arthurcruvinel@usp.br)
