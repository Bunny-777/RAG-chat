from dataclasses import dataclass
from typing import Optional, List, Any
import os

from langchain_core.documents import Document
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import PromptTemplate
from langchain_core.runnables import RunnableParallel, RunnablePassthrough, RunnableLambda
from langchain_core.vectorstores import VectorStoreRetriever
from langchain_community.vectorstores import FAISS
from langchain_groq import ChatGroq

from backend.app.core.config import settings
from backend.app.core.exceptions import ModelProviderError
from backend.app.core.logging import get_logger
from backend.app.ingestion.youtube import create_youtube_documents
from backend.app.rag.chunking import split_documents
from backend.app.rag.vectorstore import create_vectorstore
from backend.app.rag.retriever import get_retriever, format_documents

logger = get_logger(__name__)

# Standard RAG prompt preserving original behavior
YOUTUBE_QA_PROMPT = PromptTemplate(
    template="""
You are a helpful assistant.
Answer ONLY from the provided transcript context.
If the context is insufficient, just say you don't know.

{context}
Question: {question}
""",
    input_variables=["context", "question"],
)


@dataclass
class YouTubeIndexResult:
    """Result data container for an indexed YouTube video."""
    video_id: str
    source_id: str
    url: str
    language: str
    chunk_count: int
    vector_store: FAISS
    retriever: VectorStoreRetriever
    raw_documents: List[Document]
    chunks: List[Document]


class YouTubeRAGService:
    """
    Reusable service for processing YouTube videos, chunking, indexing in FAISS,
    and executing grounded Question-Answering using LangChain and Groq.
    """

    def __init__(self, prompt: Optional[PromptTemplate] = None):
        self.prompt = prompt or YOUTUBE_QA_PROMPT

    def get_llm(
        self,
        api_key: Optional[str] = None,
        model_name: Optional[str] = None,
        temperature: Optional[float] = None,
    ) -> BaseChatModel:
        """Returns a configured ChatGroq instance."""
        key = api_key or settings.GROQ_API_KEY
        if not key:
            raise ModelProviderError(
                "Groq API key not found. Please set GROQ_API_KEY in your environment."
            )
        model = model_name or settings.LLM_MODEL_NAME
        temp = temperature if temperature is not None else settings.LLM_TEMPERATURE
        return ChatGroq(
            groq_api_key=key,
            model_name=model,
            temperature=temp,
        )

    def ingest_and_index_video(
        self,
        url: str,
        manual_transcript: Optional[str] = None,
        chunk_size: Optional[int] = None,
        chunk_overlap: Optional[int] = None,
        k: Optional[int] = None,
        source_id: Optional[str] = None,
    ) -> YouTubeIndexResult:
        """
        Orchestrates full ingestion of a YouTube video:
        1. Transcript extraction (with translation / manual fallback).
        2. Normalization into LangChain Documents.
        3. Recursive chunking with metadata preservation.
        4. FAISS vector store creation.
        5. Retriever construction.
        """
        logger.info(f"Ingesting YouTube video from: {url}")
        docs, meta = create_youtube_documents(
            url=url,
            manual_transcript=manual_transcript,
            source_id=source_id,
        )

        c_size = chunk_size if chunk_size is not None else settings.DEFAULT_CHUNK_SIZE
        c_overlap = chunk_overlap if chunk_overlap is not None else settings.DEFAULT_CHUNK_OVERLAP
        top_k = k if k is not None else settings.DEFAULT_TOP_K

        chunks = split_documents(docs, chunk_size=c_size, chunk_overlap=c_overlap)
        vector_store = create_vectorstore(chunks)
        retriever = get_retriever(vector_store, k=top_k)

        logger.info(
            f"Successfully indexed video ID '{meta['video_id']}' with {len(chunks)} chunk(s)."
        )

        return YouTubeIndexResult(
            video_id=meta["video_id"],
            source_id=meta["source_id"],
            url=meta["url"],
            language=meta["language"],
            chunk_count=len(chunks),
            vector_store=vector_store,
            retriever=retriever,
            raw_documents=docs,
            chunks=chunks,
        )

    def create_qa_chain(
        self,
        retriever: VectorStoreRetriever,
        llm: Optional[BaseChatModel] = None,
    ) -> Any:
        """
        Builds the LCEL QA Runnable chain:
        (retriever + passthrough) -> prompt -> LLM -> StrOutputParser
        """
        active_llm = llm or self.get_llm()
        parallel_chain = RunnableParallel(
            {
                "context": retriever | RunnableLambda(format_documents),
                "question": RunnablePassthrough(),
            }
        )
        return parallel_chain | self.prompt | active_llm | StrOutputParser()

    def query(
        self,
        retriever: VectorStoreRetriever,
        question: str,
        llm: Optional[BaseChatModel] = None,
    ) -> str:
        """Runs question answering over the indexed video transcript."""
        chain = self.create_qa_chain(retriever=retriever, llm=llm)
        logger.info(f"Executing QA query: '{question}'")
        return chain.invoke(question)


# Singleton instance for simple importing
youtube_rag_service = YouTubeRAGService()
