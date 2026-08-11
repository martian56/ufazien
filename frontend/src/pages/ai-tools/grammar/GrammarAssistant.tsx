import { Sparkles } from "lucide-react"
import AiToolWorkspace from "../../../features/ai-tools/AiToolWorkspace"

/**
 * Grammar Assistant.
 *
 * The menu advertised this with a "Coming Soon" badge while
 * services.check_grammar had been implemented all along and
 * /ai-tools/process/ already accepted its tool type. This page is what was
 * missing.
 *
 * No options are offered because the service reads none: it works from the
 * input text alone, and a control that changed nothing would be worse than
 * no control.
 */
export default function GrammarAssistant() {
  return (
    <AiToolWorkspace
      toolType="grammar_checker"
      title="Grammar Assistant"
      tagline="Fix grammar, spelling and awkward phrasing"
      icon={Sparkles}
      inputLabel="Text to check"
      outputLabel="Corrected text"
      placeholder="Paste the text you want checked..."
      actionLabel="Check grammar"
    />
  )
}
