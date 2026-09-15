"""
CLI Entry Point for YouTube RAG Chat.
Refactored to use the modular backend service layer.
"""
import sys
from backend.app.services.youtube_rag_service import youtube_rag_service
from backend.app.core.exceptions import ResearchAppException
from backend.app.core.logging import get_logger

logger = get_logger("cli")


def main():
    print("=" * 60)
    print("  YouTube RAG Chatbot (Modular CLI)")
    print("=" * 60)

    url = input("\nEnter your YouTube video URL: ").strip()
    if not url:
        print("Error: URL cannot be empty.")
        return

    print("\n[1/3] Extracting transcript and building vector index...")
    try:
        result = youtube_rag_service.ingest_and_index_video(url=url)
        print(f"✓ Successfully indexed video ID: {result.video_id}")
        print(f"✓ Language: {result.language}")
        print(f"✓ Total chunks indexed: {result.chunk_count}")
    except ResearchAppException as exc:
        print(f"Error during ingestion: {exc.message}")
        return
    except Exception as exc:
        print(f"Unexpected error: {exc}")
        return

    print("\n[2/3] Initializing QA chain with Groq LLaMA 3.3 70B...")
    try:
        chain = youtube_rag_service.create_qa_chain(retriever=result.retriever)
        print("✓ QA Chain ready.")
    except Exception as exc:
        print(f"Error configuring QA chain: {exc}")
        return

    print("\n[3/3] Ask questions about the video. Type 'Exit' or 'quit' to stop.\n")
    while True:
        try:
            query = input("Enter your query: ").strip()
            if not query:
                continue
            if query.lower() in ("exit", "quit", "q"):
                print("Exiting. Goodbye!")
                break

            print("\nGenerating answer...")
            answer = chain.invoke(query)
            print(f"\nAnswer:\n{answer}\n")
            print("-" * 60)
        except KeyboardInterrupt:
            print("\nExiting. Goodbye!")
            break
        except Exception as exc:
            print(f"Error answering query: {exc}")


if __name__ == "__main__":
    main()
