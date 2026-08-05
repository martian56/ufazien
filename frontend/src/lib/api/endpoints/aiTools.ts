import { api } from '../client'

export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'

export interface AiTask {
  task_id: string
  status: TaskStatus
  output_text?: string
  error_message?: string
  processing_time?: number
}

export interface HumanizeOptions {
  writingStyle?: string
  preserveFormatting?: boolean
  targetTone?: string
}

const BASE = '/ai-tools'

const POLL_INTERVAL_MS = 2000
const DEFAULT_TIMEOUT_MS = 120_000

export const aiToolsApi = {
  getStatus: () => api.get(`${BASE}/status/`),

  humanizeText: (inputText: string, options: HumanizeOptions = {}) =>
    api.post<AiTask>(`${BASE}/humanizer/`, {
      input_text: inputText,
      writing_style: options.writingStyle || 'natural',
      preserve_formatting: options.preserveFormatting !== false,
      target_tone: options.targetTone || '',
    }),

  processText: (toolType: string, inputText: string, options: Record<string, unknown> = {}) =>
    api.post<AiTask>(`${BASE}/process/`, { tool_type: toolType, input_text: inputText, ...options }),

  getTaskStatus: (taskId: string) => api.get<AiTask>(`${BASE}/tasks/${taskId}/status/`),

  getTaskDetail: (taskId: string) => api.get<AiTask>(`${BASE}/tasks/${taskId}/`),

  cancelTask: (taskId: string) => api.post(`${BASE}/tasks/${taskId}/cancel/`),

  getTaskHistory: (options: { toolType?: string; limit?: number; page?: number } = {}) =>
    api.get(`${BASE}/tasks/`, {
      params: {
        tool_type: options.toolType && options.toolType !== 'all' ? options.toolType : undefined,
        limit: options.limit,
        page: options.page,
      },
    }),

  getUserStats: () => api.get(`${BASE}/stats/`),

  /** Poll until the task settles, or give up after `timeout`. */
  async pollTaskStatus(
    taskId: string,
    onProgress?: ((task: AiTask) => void) | null,
    timeout = DEFAULT_TIMEOUT_MS,
  ): Promise<AiTask> {
    const startedAt = Date.now()

    for (;;) {
      if (Date.now() - startedAt > timeout) throw new Error('Task polling timeout')

      const task = await aiToolsApi.getTaskStatus(taskId)
      onProgress?.(task)

      if (task.status === 'completed') return task
      if (task.status === 'failed') throw new Error(task.error_message || 'Task failed')
      if (task.status === 'cancelled') throw new Error('Task was cancelled')

      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
    }
  },

  async humanizeTextAndWait(
    inputText: string,
    options: HumanizeOptions = {},
    onProgress?: ((task: AiTask) => void) | null,
  ) {
    const created = await aiToolsApi.humanizeText(inputText, options)
    const result = await aiToolsApi.pollTaskStatus(created.task_id, onProgress)
    return {
      taskId: created.task_id,
      outputText: result.output_text,
      processingTime: result.processing_time,
      status: result.status,
    }
  },

  async processTextAndWait(
    toolType: string,
    inputText: string,
    options: Record<string, unknown> = {},
    onProgress?: ((task: AiTask) => void) | null,
  ) {
    const created = await aiToolsApi.processText(toolType, inputText, options)
    const result = await aiToolsApi.pollTaskStatus(created.task_id, onProgress)
    return {
      taskId: created.task_id,
      outputText: result.output_text,
      processingTime: result.processing_time,
      status: result.status,
    }
  },
}

export default aiToolsApi
