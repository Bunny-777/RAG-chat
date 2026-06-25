#CLI version 
from youtube_transcript_api import YouTubeTranscriptApi, TranscriptsDisabled
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_groq import ChatGroq
from langchain_community.vectorstores import FAISS
from langchain_core.prompts import PromptTemplate
from langchain_huggingface import HuggingFaceEmbeddings
from dotenv import load_dotenv
from langchain_core.runnables import RunnableParallel, RunnablePassthrough, RunnableLambda
from langchain_core.output_parsers import StrOutputParser
from urllib.parse import urlparse, parse_qs

load_dotenv()
parser = StrOutputParser()

def format_docs(retrieved_docs):
  context_text = "\n\n".join(doc.page_content for doc in retrieved_docs)
  return context_text


def get_video_id(url):
    parsed_url = urlparse(url)
    # Normal YouTube URL
    if parsed_url.hostname in ["www.youtube.com", "youtube.com"]:
        return parse_qs(parsed_url.query).get("v", [None])[0]
    # Short URL
    elif parsed_url.hostname == "youtu.be":
        return parsed_url.path.lstrip("/")
    return None

url=input("Enter your youtube video url:-")
video_id=get_video_id(url)
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
embeddings=HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")

#storing in vector store database
vector_store = FAISS.from_documents(chunks, embeddings)
# print("chal rha he ") testing 

#first step of RAG:- Retrieval

retriever = vector_store.as_retriever(search_type="similarity", search_kwargs={"k": 4})
# print(retriever.invoke('which android is he talking about?'))  testing the retriever


#second step of RAG:- Augmentation

llm=ChatGroq(model="llama-3.3-70b-versatile")
prompt = PromptTemplate(
    template="""
      You are a helpful assistant.
      Answer ONLY from the provided transcript context.
      If the context is insufficient, just say you don't know.

      {context}
      Question: {question}
    """,
    input_variables = ['context', 'question']
)
question          = "which android is he talking about?"
retrieved_docs    = retriever.invoke(question)

context_text = "\n\n".join(doc.page_content for doc in retrieved_docs)
final_prompt = prompt.invoke({"context": context_text, "question": question})
# print(final_prompt)

# third step of RAG :- Generation
answer = llm.invoke(final_prompt)
# print(answer.content)

#Buildig chain to automate the process
parallel_chain = RunnableParallel({
    'context': retriever | RunnableLambda(format_docs),
    'question': RunnablePassthrough()
})
main_chain = parallel_chain | prompt | llm | parser
while True:
    query=input("Enter your query :")
    if(query=='Exit'):
        break
    print(main_chain.invoke(query))
