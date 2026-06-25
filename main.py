from youtube_transcript_api import YouTubeTranscriptApi, TranscriptsDisabled
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_groq import ChatGroq
from langchain_community.vectorstores import FAISS
from langchain_core.prompts import PromptTemplate
from dotenv import load_dotenv



video_url="https://www.youtube.com/watch?v=kXB55AGmDPI"

video_id = "kXB55AGmDPI" # only the ID, not full URL
try:
    ytt_api = YouTubeTranscriptApi()
    fetched_transcript = ytt_api.fetch(video_id)
    transcript=""
    for i in fetched_transcript:
        transcript+=i.text
except TranscriptsDisabled:
    print("No captions available for this video.")

#splitting the text using text splitters 
splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
chunks = splitter.create_documents([transcript])

#generating embeddings
embeddings = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-MiniLM-L6-v2",
    model_kwargs={'device': 'cpu'}
)

#storing in vector store database
vector_store = FAISS.from_documents(chunks, embeddings)