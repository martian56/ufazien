import { MessageSquare } from "lucide-react"
import AiToolWorkspace from "../../../features/ai-tools/AiToolWorkspace"

/**
 * AI Paraphraser.
 *
 * The menu advertised this with a "Coming Soon" badge while
 * services.paraphrase_text had been implemented all along and
 * /ai-tools/process/ already accepted its tool type. This page is what was
 * missing.
 *
 * No options are offered because the service reads none: it works from the
 * input text alone, and a control that changed nothing would be worse than
 * no control.
 */
export default function Paraphraser() {
  return (
    <AiToolWorkspace
      toolType="paraphraser"
      title="AI Paraphraser"
      tagline="Rephrase text while keeping what it means"
      icon={MessageSquare}
      accent="from-purple-500 to-pink-500"
      inputLabel="Text to paraphrase"
      outputLabel="Paraphrased text"
      placeholder="Paste the text you want rewritten..."
      actionLabel="Paraphrase"
    />
  )
}
