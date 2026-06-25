import os
from urllib.parse import urlparse, parse_qs

import streamlit as st
from dotenv import load_dotenv
from youtube_transcript_api import YouTubeTranscriptApi, TranscriptsDisabled
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_groq import ChatGroq
from langchain_community.vectorstores import FAISS
from langchain_core.prompts import PromptTemplate
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_core.runnables import RunnableParallel, RunnablePassthrough, RunnableLambda
from langchain_core.output_parsers import StrOutputParser

load_dotenv()


def get_groq_api_key():
    env_key = os.getenv("GROQ_API_KEY")
    if env_key:
        return env_key

    try:
        root_secret = st.secrets.get("GROQ_API_KEY")
        if root_secret:
            os.environ["GROQ_API_KEY"] = str(root_secret)
            return str(root_secret)

        groq_section = st.secrets.get("groq", {})
        section_secret = groq_section.get("api_key") if hasattr(groq_section, "get") else None
        if section_secret:
            os.environ["GROQ_API_KEY"] = str(section_secret)
            return str(section_secret)
    except Exception:
        return None

    return None


st.set_page_config(
    page_title="Reel Talk — chat with any YouTube video",
    page_icon="🎞️",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ----------------------------------------------------------------------------
# Design system
# Cinema / screening-room palette: warm amber projector light on near-black,
# with a film-sprocket motif as the page's one signature element.
# ----------------------------------------------------------------------------
st.markdown(
    """
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');

    :root {
        --bg: #14131A;
        --surface: #1E1C26;
        --surface-2: #262332;
        --border: #322E40;
        --amber: #E8A33D;
        --red: #C1432B;
        --text: #F2EDE4;
        --muted: #938C9C;
    }

    .stApp {
        background: var(--bg);
        color: var(--text);
        font-family: 'Inter', sans-serif;
    }

    section[data-testid="stSidebar"] {
        background: var(--surface);
        border-right: 1px solid var(--border);
    }
    section[data-testid="stSidebar"] * { color: var(--text) !important; }

    h1, h2, h3 { font-family: 'Space Grotesk', sans-serif; letter-spacing: -0.01em; }

    .eyebrow {
        font-family: 'IBM Plex Mono', monospace;
        font-size: 0.72rem;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: var(--amber);
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .rec-dot {
        width: 7px; height: 7px; border-radius: 50%;
        background: var(--red);
        animation: pulse 1.6s ease-in-out infinite;
    }
    @media (prefers-reduced-motion: reduce) { .rec-dot { animation: none; } }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }

    .hero-title {
        font-size: 2.3rem;
        font-weight: 700;
        margin: 6px 0 2px 0;
    }
    .hero-sub { color: var(--muted); font-size: 0.98rem; margin-bottom: 18px; }

    .sprocket-strip {
        height: 16px;
        background: var(--amber);
        -webkit-mask-image: radial-gradient(circle, transparent 5px, black 5.6px);
        mask-image: radial-gradient(circle, transparent 5px, black 5.6px);
        -webkit-mask-size: 22px 16px;
        mask-size: 22px 16px;
        -webkit-mask-repeat: repeat-x;
        mask-repeat: repeat-x;
        opacity: 0.85;
        margin: 4px 0 26px 0;
        border-radius: 2px;
    }

    .empty-card {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 14px;
        padding: 36px 32px;
        margin-top: 8px;
    }
    .empty-card h3 { margin-top: 0; }
    .empty-card ul { color: var(--muted); line-height: 1.7; }

    .meta-card {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 14px;
        padding: 16px 18px;
        margin-top: 14px;
        font-family: 'IBM Plex Mono', monospace;
        font-size: 0.82rem;
        color: var(--muted);
    }
    .meta-card b { color: var(--amber); }

    div[data-testid="stChatInput"] textarea {
        background: var(--surface-2) !important;
        border: 1px solid var(--border) !important;
        color: var(--text) !important;
        border-radius: 10px !important;
    }

    .stButton > button {
        background: var(--amber);
        color: #1A1308;
        border: none;
        font-weight: 600;
        border-radius: 8px;
    }
    .stButton > button:hover { background: #f0b25c; color: #1A1308; }

    .stTextInput input, .stSlider {
        color: var(--text);
    }
    .stTextInput input {
        background: var(--surface-2) !important;
        border: 1px solid var(--border) !important;
    }

    div[data-testid="stChatMessage"] {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 4px 6px;
    }
    </style>
    """,
    unsafe_allow_html=True,
)

# ----------------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------------

def get_video_id(url: str):
    parsed = urlparse(url.strip())
    if parsed.hostname in ("www.youtube.com", "youtube.com", "m.youtube.com"):
        return parse_qs(parsed.query).get("v", [None])[0]
    if parsed.hostname == "youtu.be":
        return parsed.path.lstrip("/")
    return None


def format_docs(retrieved_docs):
    return "\n\n".join(doc.page_content for doc in retrieved_docs)


def fetch_best_transcript(video_id: str):
    ytt_api = YouTubeTranscriptApi()

    try:
        fetched = ytt_api.fetch(video_id, languages=["en", "hi"])
        return fetched, "en/hi"
    except Exception:
        pass

    transcript_list = ytt_api.list(video_id)

    try:
        transcript = transcript_list.find_transcript(["en", "hi"])
    except Exception:
        transcript = next(iter(transcript_list), None)

    if transcript is None:
        raise ValueError("No transcript was found for this video.")

    if getattr(transcript, "language_code", None) != "en" and getattr(transcript, "is_translatable", False):
        try:
            transcript = transcript.translate("en")
        except Exception:
            pass

    return transcript.fetch(), getattr(transcript, "language_code", "available")


PROMPT = PromptTemplate(
    template="""
You are a helpful assistant.
Answer ONLY from the provided transcript context.
If the context is insufficient, just say you don't know.

{context}
Question: {question}
""",
    input_variables=["context", "question"],
)


@st.cache_resource(show_spinner=False)
def load_embeddings():
    # Cached for the life of the server process — loads once, not per run.
    return HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")


@st.cache_resource(show_spinner=False)
def load_llm():
    get_groq_api_key()
    return ChatGroq(model="llama-3.3-70b-versatile")


def process_video(url, chunk_size, chunk_overlap, k):
    video_id = get_video_id(url)
    if not video_id:
        return None, "Couldn't find a video ID in that URL — check the link and try again."

    try:
        fetched, transcript_language = fetch_best_transcript(video_id)
        transcript = "".join(item.text for item in fetched)
    except TranscriptsDisabled:
        return None, "This video has captions disabled, so there's no transcript to read."
    except Exception as e:
        return None, f"Couldn't fetch a transcript for this video: {e}"

    if not transcript.strip():
        return None, "The transcript came back empty — try a different video."

    splitter = RecursiveCharacterTextSplitter(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    chunks = splitter.create_documents([transcript])

    embeddings = load_embeddings()
    vector_store = FAISS.from_documents(chunks, embeddings)
    retriever = vector_store.as_retriever(search_type="similarity", search_kwargs={"k": k})

    return {
        "video_id": video_id,
        "retriever": retriever,
        "chunk_count": len(chunks),
        "transcript_language": transcript_language,
    }, None


# ----------------------------------------------------------------------------
# Session state
# ----------------------------------------------------------------------------
if "video_data" not in st.session_state:
    st.session_state.video_data = None
if "messages" not in st.session_state:
    st.session_state.messages = []

# ----------------------------------------------------------------------------
# Sidebar — controls
# ----------------------------------------------------------------------------
with st.sidebar:
    st.markdown('<div class="eyebrow"><span class="rec-dot"></span> LOAD A REEL</div>', unsafe_allow_html=True)
    st.markdown("### Drop a YouTube link")

    url = st.text_input("YouTube URL", placeholder="https://www.youtube.com/watch?v=...", label_visibility="collapsed")

    with st.expander("Advanced settings"):
        chunk_size = st.slider("Chunk size", 500, 2000, 1000, 100)
        chunk_overlap = st.slider("Chunk overlap", 0, 500, 200, 50)
        k = st.slider("Chunks retrieved per question", 1, 8, 4)

    process_clicked = st.button("Process video", use_container_width=True, type="primary")

    groq_api_key = get_groq_api_key()

    if not groq_api_key:
        st.markdown("---")
        st.warning("No GROQ_API_KEY found in your environment or Streamlit secrets.")
        manual_key = st.text_input("Groq API key", type="password")
        if manual_key:
            os.environ["GROQ_API_KEY"] = manual_key
            groq_api_key = manual_key

    if process_clicked:
        if not url:
            st.error("Paste a YouTube URL first.")
        elif not groq_api_key:
            st.error("A Groq API key is required before processing.")
        else:
            with st.spinner("Reading the transcript and building the index..."):
                data, err = process_video(url, chunk_size, chunk_overlap, k)
            if err:
                st.error(err)
            else:
                st.session_state.video_data = data
                st.session_state.messages = []
                st.success(f"Indexed {data['chunk_count']} chunks.")

    st.markdown("---")
    st.caption("Embeddings: all-MiniLM-L6-v2 (local) · LLM: Llama 3.3 70B via Groq")

# ----------------------------------------------------------------------------
# Main area
# ----------------------------------------------------------------------------
st.markdown('<div class="eyebrow"><span class="rec-dot"></span> NOW SCREENING</div>', unsafe_allow_html=True)
st.markdown('<div class="hero-title">Reel Talk</div>', unsafe_allow_html=True)
st.markdown('<div class="hero-sub">Ask questions about any YouTube video, answered straight from its transcript.</div>', unsafe_allow_html=True)
st.markdown('<div class="sprocket-strip"></div>', unsafe_allow_html=True)

if not st.session_state.video_data:
    st.markdown(
        """
        <div class="empty-card">
        <h3>No video loaded yet</h3>
        <ul>
            <li>Paste a YouTube URL in the sidebar</li>
            <li>Click <b>Process video</b> to index its transcript</li>
            <li>Ask questions about it below — answers come only from what's said in the video</li>
        </ul>
        </div>
        """,
        unsafe_allow_html=True,
    )
else:
    data = st.session_state.video_data
    col_video, col_chat = st.columns([1, 1.4], gap="large")

    with col_video:
        st.video(f"https://www.youtube.com/watch?v={data['video_id']}")
        st.markdown(
            f"""
            <div class="meta-card">
            <b>Video ID</b> {data['video_id']}<br/>
            <b>Chunks indexed</b> {data['chunk_count']}<br/>
            <b>Retrieving</b> top {k} matches per question
            </div>
            """,
            unsafe_allow_html=True,
        )

    with col_chat:
        chat_box = st.container(height=440)
        with chat_box:
            for msg in st.session_state.messages:
                with st.chat_message(msg["role"]):
                    st.markdown(msg["content"])

        query = st.chat_input("Ask something about this video...")
        if query:
            st.session_state.messages.append({"role": "user", "content": query})

            llm = load_llm()
            chain = (
                RunnableParallel(
                    {
                        "context": data["retriever"] | RunnableLambda(format_docs),
                        "question": RunnablePassthrough(),
                    }
                )
                | PROMPT
                | llm
                | StrOutputParser()
            )

            with st.spinner("Thinking..."):
                try:
                    answer = chain.invoke(query)
                except Exception as e:
                    answer = f"Something went wrong calling the model: {e}"

            st.session_state.messages.append({"role": "assistant", "content": answer})
            st.rerun()
