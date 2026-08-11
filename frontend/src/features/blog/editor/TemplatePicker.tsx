import { FileText } from "lucide-react"

interface Template {
  id: number | string
  name: string
  content?: string
}

interface TemplatePickerProps {
  darkMode: boolean
  templates: Template[]
  onSelect: (template: Template) => void
}


/** Starting points that drop a skeleton into an empty editor. */
export default function TemplatePicker({ darkMode, templates, onSelect }: TemplatePickerProps) {
  return (
    <div className={`rounded-xl border p-6 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
      <h3 className="font-semibold flex items-center mb-4">
        <FileText className="w-4 h-4 mr-2" />
        Templates
      </h3>

      <div className="space-y-2">
        {templates.map((template) => (
          <button
            key={template.id}
            onClick={() => onSelect(template)}
            className={`w-full text-left p-3 rounded-lg transition-colors ${
              darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
            }`}
          >
            <div className="font-medium text-sm">{template.name}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
