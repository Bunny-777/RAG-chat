from youtube_transcript_api import YouTubeTranscriptApi, TranscriptsDisabled
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_groq import ChatGroq
from langchain_core.prompts import PromptTemplate
from dotenv import load_dotenv



video_url="https://www.youtube.com/watch?v=kXB55AGmDPI"

video_id = "9tlsHKAoPkY" # only the ID, not full URL
try:
    ytt_api = YouTubeTranscriptApi()
    fetched_transcript = ytt_api.fetch(video_id)
    transcript=""
    for i in fetched_transcript:
        transcript+=i.text
    print(transcript)
except TranscriptsDisabled:
    print("No captions available for this video.")

