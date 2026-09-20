import { createFileRoute } from "@tanstack/react-router";
import { ResearchWorkspace } from "@/features/research/ResearchWorkspace";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AI Research Analyst — Multi-Source Research Workspace" },
      { name: "description", content: "Research across live web results, documents, and YouTube transcripts in one cited AI workspace." },
      { property: "og:title", content: "AI Research Analyst" },
      { property: "og:description", content: "A multi-source AI workspace for structured, cited research." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return <ResearchWorkspace />;
}
