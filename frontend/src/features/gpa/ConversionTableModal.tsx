import { X } from "lucide-react"

interface ConversionRow {
  min: number
  max: number
  gpa: number
  letter: string
  status: string
  azMin: number
  azMax: number
}

interface ConversionTableModalProps {
  onClose: () => void
  ufazConversionTable: ConversionRow[]
}


export default function ConversionTableModal({ onClose, ufazConversionTable }: ConversionTableModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">UFAZ Grade Conversion Table</h2>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-300 px-4 py-2 text-left">UFAZ Range</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">Status</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">Letter Grade</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">GPA Points</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">Azerbaijan Equiv.</th>
                </tr>
              </thead>
              <tbody>
                {ufazConversionTable.map((row, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="border border-gray-300 px-4 py-2">
                      {row.min} - {row.max}
                    </td>
                    <td className="border border-gray-300 px-4 py-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        row.status === "Perfect" || row.status === "Excellent" ? "bg-green-100 text-green-700" :
                        row.status === "Good" ? "bg-blue-100 text-blue-700" :
                        row.status === "Enough" ? "bg-yellow-100 text-yellow-700" :
                        "bg-red-100 text-red-700"
                      }`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="border border-gray-300 px-4 py-2 font-semibold">{row.letter}</td>
                    <td className="border border-gray-300 px-4 py-2 font-semibold text-blue-600">{row.gpa}</td>
                    <td className="border border-gray-300 px-4 py-2">{row.azMin} - {row.azMax}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">About UFAZ Grading System</h4>
            <ul className="text-blue-700 text-sm space-y-1">
              <li>• Based on the French 20-point academic grading system</li>
              <li>• Perfect (16-20): Exceptional performance, equivalent to A+ grades</li>
              <li>• Excellent (13.5-16): High achievement, equivalent to A grades</li>
              <li>• Good (11.5-13.5): Satisfactory performance, equivalent to B grades</li>
              <li>• Enough (10-11.5): Minimum passing standard, equivalent to C grades</li>
              <li>• Fail (0-10): Below passing standard, requires retaking</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
