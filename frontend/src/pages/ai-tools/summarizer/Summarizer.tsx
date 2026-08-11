import { FileText } from "lucide-react"
import AiToolWorkspace from "../../../features/ai-tools/AiToolWorkspace"

/**
 * Text Summarizer.
 *
 * The menu advertised this with a "Coming Soon" badge while
 * services.summarize_text had been implemented all along and
 * /ai-tools/process/ already accepted its tool type. This page is what was
 * missing.
 *
 * No options are offered because the service reads none: it works from the
 * input text alone, and a control that changed nothing would be worse than
 * no control.
 */
export default function Summarizer() {
  return (
    <AiToolWorkspace
      toolType="summarizer"
      title="Text Summarizer"
      tagline="Turn something long into its essentials"
      icon={FileText}
      inputLabel="Text to summarize"
      outputLabel="Summary"
      placeholder="Paste an article, a chapter, or your lecture notes..."
      actionLabel="Summarize"
    />
  )
}
