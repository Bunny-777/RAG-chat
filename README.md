# 🧠 AI Research Analyst & Multi-Tool RAG Workspace

An enterprise-grade, ChatGPT-style research and intelligence assistant powered by **Groq LLMs**, local vector embeddings (**FAISS + MiniLM**), multi-source retrieval (documents, YouTube transcripts, live web intelligence), and an autonomous **Intelligent Tool Router**.

---

## 🌟 Core Features

- **ChatGPT-Style Unified Interface**:
  - **History-Only Sidebar**: Minimalist conversational threads list with one-click **New Chat**, relative timestamps, message counters, and session deletion.
  - **Inline Prompt Dock Attachments**: Click the **Paperclip** icon to attach documents (`.pdf`, `.docx`, `.txt`, `.md`, `.csv`) directly within the prompt bar.
  - **Auto-Detection for Links & Videos**: Paste any YouTube video URL or webpage link directly into your prompt—it is automatically detected, extracted, and indexed on the fly.
  - **Local History Synchronization**: Instant session restoration on browser refresh via `localStorage` state caching.

- **Intelligent Query Classification & Tool Router**:
  Every user query is analyzed and routed dynamically to the best-fit execution tool:
  - 🕒 **`datetime`**: Real-time clock & calendar (UTC & local) to eliminate temporal hallucinations.
  - 🧮 **`calculator`**: Deterministic safe AST math engine for calculations and formulas.
  - 💻 **`code_interpreter`**: Sandboxed Python script execution for algorithms and data operations.
  - 🌐 **`web_search`**: Google Search (via Serper API) with DuckDuckGo fallback for live events, prices, and facts.
  - 📖 **`wikipedia`**: Dedicated encyclopedic summaries for definitions and historical background.
  - 🔗 **`url_reader`**: Direct web page scraper and text analyzer.
  - 📄 **`rag_search`**: Semantic vector search across attached and uploaded documents.
  - ⚡ **`direct_llm`**: Direct high-speed reasoning when external data is not required.

- **Dynamic Research Modes**:
  - **⚡ Quick Flash**: Direct answers, exact numbers, and bottom-line takeaways with minimal latency.
  - **📚 Standard**: Balanced multi-source investigation with Executive Summary, Key Findings, and source citations.
  - **🧠 Deep Reasoning**: Exhaustive comparative analysis with progressive thinking traces, evidence evaluation, trade-offs, and strategic conclusions.

- **Real-Time Streaming & Visual Trace**:
  - Server-Sent Events (SSE) stream tool execution traces, live reasoning thoughts, and verified source badges as they are discovered.

- **Export & Citations**:
  - Clickable source cards with domain badges.
  - One-click **Copy Markdown** or **Export Markdown Report** for easy note-taking and documentation.

---

## 🏗️ Architecture & Tech Stack

```
[ Frontend: React + Vite + TypeScript (Port 8080) ]
                       │
                       │  HTTP & Server-Sent Events (SSE)
                       ▼
[ Backend API: FastAPI + Uvicorn (Port 8000) ]
                       │
         ┌─────────────┴──────────────┐
         ▼                            ▼
[ Intelligent Classifier ]     [ Multi-Source Ingestion ]
  ├─ Datetime Tool               ├─ YouTube Transcripts
  ├─ AST Calculator              └─ Document Loader (PDF/Word/TXT/MD/CSV)
  ├─ Python Code Sandbox                      │
  ├─ Google / Serper Search                   ▼
  ├─ Wikipedia Encyclopedia      [ FAISS Vector Store (MiniLM-L6-v2) ]
  └─ URL Reader                               │
         │                                    │
         └──────────────────┬─────────────────┘
                            ▼
        [ LLM Synthesis (Groq Llama 3.3 / GPT-OSS) ]
```

### Technology Highlights

- **Frontend**: React 18, Vite 8, TypeScript, Tailwind CSS, Radix UI, Lucide Icons, React Markdown.
- **Backend**: FastAPI, Uvicorn, Pydantic V2, LangChain, Starlette SSE.
- **Inference**: [Groq](https://groq.com/) high-speed inference engine (`openai/gpt-oss-120b`, `llama-3.3-70b-versatile`).
- **Embeddings**: `sentence-transformers/all-MiniLM-L6-v2` (run 100% locally via HuggingFace).
- **Vector Database**: FAISS (Facebook AI Similarity Search).
- **Search Intelligence**: Serper Google Search API + DuckDuckGo search fallback.

---

## 📂 Project Structure

```
RAG-chat/
├── backend/
│   └── app/
│       ├── api/                        # FastAPI Route Handlers
│       │   ├── health.py               # /health status check
│       │   ├── research.py             # /research & /research/stream (SSE)
│       │   ├── sessions.py             # Chat session management & history
│       │   ├── sources.py              # Knowledge base index endpoints
│       │   └── upload.py               # File & YouTube ingestion APIs
│       ├── core/                       # App Configuration & System Logging
│       │   ├── config.py               # Environment variable bindings
│       │   ├── exceptions.py           # Domain error hierarchy
│       │   └── logging.py              # Structured console & file logging
│       ├── ingestion/                  # Raw Source Parsing
│       │   ├── document.py             # PDF, DOCX, TXT, MD, CSV parser
│       │   └── youtube.py              # YouTube transcript extraction
│       ├── models/                     # Pydantic V2 Data Contracts
│       │   ├── requests.py             # API request schemas
│       │   └── responses.py            # API response schemas
│       ├── rag/                        # Embeddings & Vector Stores
│       │   ├── embeddings.py           # HuggingFace MiniLM loader
│       │   └── vector_store.py         # FAISS vector indexer & retriever
│       ├── services/                   # Business Logic & Orchestration
│       │   ├── document_rag_service.py # Document chunking & indexing
│       │   ├── research_service.py     # Multi-tool pipeline & report synthesis
│       │   ├── session_store.py        # Conversational memory & turns
│       │   ├── source_store.py         # In-memory index registry
│       │   └── youtube_rag_service.py  # YouTube RAG service & QA chains
│       ├── tools/                      # Modular Tool Suite
│       │   ├── calculator.py           # Safe AST math calculation
│       │   ├── classifier.py           # Query classification & routing
│       │   ├── code_interpreter.py     # Sandboxed Python execution
│       │   ├── datetime_tool.py        # Local & UTC clock
│       │   ├── rag_tool.py             # Multi-source vector query tool
│       │   ├── url_reader.py           # Direct webpage reader
│       │   ├── web_search.py           # Google / Serper / DuckDuckGo search
│       │   └── wikipedia_tool.py       # Wikipedia encyclopedia search
│       └── main.py                     # FastAPI application factory
├── frontend/                           # Vite + React + TypeScript Web App
│   ├── src/
│   │   ├── components/                 # UI primitives (Buttons, Badges, Dialogs)
│   │   ├── features/research/          # Research Feature Module
│   │   │   ├── ResearchWorkspace.tsx   # ChatGPT-style workspace UI
│   │   │   ├── api.ts                  # Typed client & SSE reader
│   │   │   └── types.ts                # Frontend TypeScript models
│   │   ├── styles.css                  # Tailwind styles & theme variables
│   │   └── router.tsx                  # Application routing
│   ├── package.json                    # Frontend npm configuration
│   └── vite.config.ts                  # Vite build settings
├── tests/                              # Pytest Automated Test Suite
│   ├── test_api.py                     # End-to-end API route tests
│   ├── test_classifier_and_tools.py    # Classifier & tool validation
│   ├── test_document_ingestion.py      # Document upload & chunking tests
│   ├── test_rag_pipeline.py            # Vector retrieval tests
│   ├── test_research_modes.py          # Quick, standard & deep mode tests
│   ├── test_sessions_and_memory.py     # Conversational history tests
│   ├── test_tools.py                   # Math & search tool tests
│   └── test_youtube_ingestion.py       # YouTube transcript parser tests
├── .env.example                        # Environment variable template
├── requirements.txt                    # Python backend dependencies
└── README.md                           # Documentation & user guide
```

---

## 🚀 Getting Started

### Prerequisites

- **Python**: Version `3.10` or higher
- **Node.js**: Version `18.0` or higher (with `npm`)
- **Groq API Key**: Free API key from [Groq Console](https://console.groq.com/keys)
- **Serper API Key** *(Optional, for Google Search)*: Free key from [Serper.dev](https://serper.dev)

---

### Step 1: Clone and Configure Environment

```bash
git clone https://github.com/Bunny-777/RAG-chat.git
cd RAG-chat
```

Create your `.env` configuration:

```bash
cp .env.example .env
```

Edit `.env` and configure your API keys:

```env
# Required: Groq LLM API Key
GROQ_API_KEY=gsk_your_groq_api_key_here

# Model Selection
LLM_MODEL_NAME=openai/gpt-oss-120b
EMBEDDING_MODEL_NAME=sentence-transformers/all-MiniLM-L6-v2

# Optional: Google Web Search API Key
SERPER_API_KEY=your_serper_api_key_here
```

---

### Step 2: Backend Setup & Launch

1. Create and activate a Python virtual environment:

   ```powershell
   # Windows (PowerShell)
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   ```

   ```bash
   # Linux / macOS
   python3 -m venv .venv
   source .venv/bin/activate
   ```

2. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

3. Launch the FastAPI server on port `8000`:

   ```bash
   uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

   - **API Root**: [http://localhost:8000](http://localhost:8000)
   - **Interactive Swagger Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
   - **Health Check**: [http://localhost:8000/health](http://localhost:8000/health)

---

### Step 3: Frontend Setup & Launch

1. Open a new terminal and navigate to `frontend/`:

   ```bash
   cd frontend
   ```

2. Install npm packages:

   ```bash
   npm install
   ```

3. Start the Vite development server on port `8080`:

   ```bash
   npm run dev -- --port 8080
   ```

4. Open your browser at [http://localhost:8080](http://localhost:8080).

---

## 🧪 Running Automated Tests

Run the complete test suite (50 automated unit, integration, and streaming tests):

```bash
# Windows
.\.venv\Scripts\pytest

# Linux / macOS
pytest
```

To run a specific module or test:

```bash
pytest tests/test_classifier_and_tools.py -v
pytest tests/test_research_modes.py -v
```

---

## 📖 Interactive Guide & Examples

| User Query | Classified Tool | Expected Behavior |
| :--- | :--- | :--- |
| *"What is today's date and time in UTC?"* | `datetime` | Resolves current system clock; zero hallucination. |
| *"Evaluate sqrt(256) * 14 + 8"* | `calculator` | Evaluates deterministically using safe AST parser (`232`). |
| *"Who won Super Bowl 2024 and what was the score?"* | `web_search` | Queries live Google/web index and returns cited results. |
| *Attach `contract.pdf` and ask "What are the termination terms?"* | `rag_search` | Indexes document in FAISS and cites specific sections. |
| *Paste `https://www.youtube.com/watch?v=...`* | `youtube` | Extracts video transcript, vectorizes it, and answers questions. |
| *"Explain the core principles of quantum superposition"* | `direct_llm` | Executes high-speed foundational reasoning without unnecessary search. |

---

## 🛡️ License

Distributed under the MIT License. See `LICENSE` for more information.
