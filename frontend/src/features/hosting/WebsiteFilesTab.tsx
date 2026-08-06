import type React from "react"
import { AlertCircle, FileText, Folder, RefreshCw, Upload } from "lucide-react"
import { formatStorage } from "./websiteFormat"

import type { Website } from "../../utils/hostingApi"

interface HostedFile {
  name: string
  size: number
  modified?: string | null
}

interface HostedFolder {
  name: string
  file_count: number
  modified?: string | null
}

/** A folder upload attaches this so nested paths survive; File has no writable name. */
type PickedFile = File & { relativePath?: string }

interface WebsiteFilesTabProps {
  website: Website
  files: HostedFile[]
  folders: HostedFolder[]
  selectedFiles: PickedFile[]
  onSelectFiles: (files: PickedFile[]) => void
  uploading: boolean
  onUpload: () => void
  onDownload: (name: string) => void
  onDelete: (name: string) => void
  onRefresh: () => void
  error?: string | null
}


/**
 * File manager: pick files or a whole folder, upload, then browse what is there.
 *
 * A folder upload clones each File so the browser's read-only
 * webkitRelativePath can be carried on a writable `relativePath` property.
 * Without it the upload flattens every nested file into the site root.
 */
export default function WebsiteFilesTab({
  website,
  files,
  folders,
  selectedFiles,
  onSelectFiles,
  uploading,
  onUpload,
  onDownload,
  onDelete,
  onRefresh,
  error,
}: WebsiteFilesTabProps) {
  const handleFolderPick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? [])
    onSelectFiles(
      picked.map((file) => {
        // webkitRelativePath is read-only on File, hence the clone.
        const fileWithPath = new File([file], file.name, { type: file.type }) as PickedFile
        fileWithPath.relativePath = file.webkitRelativePath
        return fileWithPath
      })
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">File Manager</h3>
        <div className="flex space-x-2">
          <label className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer inline-flex items-center">
            <Upload className="w-4 h-4 mr-2 inline" />
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(e) => onSelectFiles(Array.from(e.target.files ?? []))}
            />
            Upload Files
          </label>
          <label className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer inline-flex items-center">
            <Folder className="w-4 h-4 mr-2 inline" />
            <input
              type="file"
              multiple
              // Real attribute, absent from React's typings.
              {...{ webkitdirectory: "" }}
              className="hidden"
              onChange={handleFolderPick}
            />
            Upload Folder
          </label>
          <button
            onClick={onRefresh}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4 mr-2 inline" />
            Refresh
          </button>
        </div>
      </div>

      <div className="h-96 border-2 border-dashed border-gray-300 rounded-lg p-4 overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-gray-600">
            {files.length} files, {folders.length} folders
          </div>
          <div className="text-sm text-gray-500">
            {website.storage_used_mb ? formatStorage(website.storage_used_mb) : ''}
          </div>
        </div>

        {selectedFiles.length > 0 && (
          <div className="mb-4">
            <div className="text-sm font-medium text-gray-700 mb-2">Files to upload</div>
            <ul className="space-y-2">
              {selectedFiles.map((f, idx) => (
                <li key={idx} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                  <span className="text-sm text-gray-800">
                    {f.relativePath || f.name}
                    {f.relativePath && f.relativePath !== f.name && (
                      <span className="text-xs text-gray-400 ml-2">(from folder)</span>
                    )}
                  </span>
                  <span className="text-xs text-gray-500">{(f.size / 1024).toFixed(1)} KB</span>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex space-x-2">
              <button
                disabled={uploading}
                onClick={onUpload}
                className="px-3 py-1 bg-blue-600 text-white rounded disabled:bg-gray-400"
              >
                {uploading ? 'Uploading...' : 'Upload'}
              </button>
              <button onClick={() => onSelectFiles([])} className="px-3 py-1 border rounded">Cancel</button>
            </div>
          </div>
        )}

        <div>
          {error ? (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-2" />
              <p className="text-red-700 font-medium">Could not load your files</p>
              <p className="text-sm text-gray-600 mt-1">{error}</p>
              <button onClick={onRefresh} className="mt-3 text-blue-600 hover:text-blue-700 text-sm">
                Try again
              </button>
            </div>
          ) : files.length === 0 && folders.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-600">No files or folders uploaded yet</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500">
                  <th>Name</th>
                  <th>Type</th>
                  <th>Size</th>
                  <th>Modified</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {folders.map((folder) => (
                  <tr key={`folder-${folder.name}`} className="border-t">
                    <td className="py-2 flex items-center">
                      <Folder className="w-4 h-4 text-blue-500 mr-2" />
                      {folder.name}
                    </td>
                    <td className="py-2 text-gray-500">Folder ({folder.file_count} files)</td>
                    <td className="py-2 text-gray-500">-</td>
                    <td className="py-2 text-gray-500">
                      {folder.modified ? new Date(folder.modified).toLocaleString() : '-'}
                    </td>
                    <td className="py-2 text-right">
                      <button onClick={() => onDownload(folder.name)} className="px-2 py-1 text-sm mr-2 bg-gray-100 rounded">Download</button>
                      <button onClick={() => onDelete(folder.name)} className="px-2 py-1 text-sm bg-red-50 text-red-600 rounded">Delete</button>
                    </td>
                  </tr>
                ))}
                {files.map((f) => (
                  <tr key={`file-${f.name}`} className="border-t">
                    <td className="py-2 flex items-center">
                      <FileText className="w-4 h-4 text-gray-500 mr-2" />
                      {f.name}
                    </td>
                    <td className="py-2 text-gray-500">File</td>
                    <td className="py-2 text-gray-500">{(f.size / 1024).toFixed(1)} KB</td>
                    <td className="py-2 text-gray-500">
                      {f.modified ? new Date(f.modified).toLocaleString() : '-'}
                    </td>
                    <td className="py-2 text-right">
                      <button onClick={() => onDownload(f.name)} className="px-2 py-1 text-sm mr-2 bg-gray-100 rounded">Download</button>
                      <button onClick={() => onDelete(f.name)} className="px-2 py-1 text-sm bg-red-50 text-red-600 rounded">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
