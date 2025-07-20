class AIToolsApiService {
    constructor() {
        this.baseURL = import.meta.env.VITE_API_URL + '/api/ai-tools';
        this.defaultHeaders = {
            'Content-Type': 'application/json',
        };
    }

    /**
     * Get authorization headers with current user token
     */
    getAuthHeaders() {
        const token = localStorage.getItem('access');
        return {
            ...this.defaultHeaders,
            'Authorization': token ? `Bearer ${token}` : '',
        };
    }

    /**
     * Make API request with error handling
     */
    async apiRequest(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: this.getAuthHeaders(),
            ...options,
        };

        console.log('AI Tools API Request:', url, config);

        try {
            const response = await fetch(url, config);
            
            console.log('AI Tools API Response Status:', response.status);
            
            if (!response.ok) {
                let errorMessage = `HTTP ${response.status}`;
                try {
                    const errorText = await response.text();
                    console.log('AI Tools API Error Text:', errorText);
                    
                    try {
                        const errorData = JSON.parse(errorText);
                        console.log('AI Tools API Error Data:', errorData);
                        errorMessage = errorData.detail || errorData.message || errorData.error || JSON.stringify(errorData);
                    } catch (jsonParseError) {
                        errorMessage = errorText || errorMessage;
                    }
                } catch (textError) {
                    console.log('Failed to read error response:', textError);
                    errorMessage = `HTTP ${response.status}`;
                }
                throw new Error(errorMessage);
            }

            const data = await response.json();
            console.log('AI Tools API Response Data:', data);
            return data;
        } catch (error) {
            console.error(`AI Tools API request failed for ${endpoint}:`, error);
            throw error;
        }
    }

    /**
     * Get AI tools service status and user stats
     */
    async getStatus() {
        return this.apiRequest('/status/');
    }

    /**
     * Create a text humanization task
     */
    async humanizeText(inputText, options = {}) {
        const requestBody = {
            input_text: inputText,
            writing_style: options.writingStyle || 'natural',
            preserve_formatting: options.preserveFormatting !== false,
            target_tone: options.targetTone || '',
        };

        console.log('Creating humanizer task with:', requestBody);
        
        return this.apiRequest('/humanizer/', {
            method: 'POST',
            body: JSON.stringify(requestBody),
        });
    }

    /**
     * Process text with any AI tool
     */
    async processText(toolType, inputText, options = {}) {
        const requestBody = {
            tool_type: toolType,
            input_text: inputText,
            ...options,
        };

        console.log('Creating task with:', requestBody);
        
        return this.apiRequest('/process/', {
            method: 'POST',
            body: JSON.stringify(requestBody),
        });
    }

    /**
     * Get task status
     */
    async getTaskStatus(taskId) {
        return this.apiRequest(`/tasks/${taskId}/status/`);
    }

    /**
     * Get detailed task information
     */
    async getTaskDetail(taskId) {
        return this.apiRequest(`/tasks/${taskId}/`);
    }

    /**
     * Cancel a task
     */
    async cancelTask(taskId) {
        return this.apiRequest(`/tasks/${taskId}/cancel/`, {
            method: 'POST',
        });
    }

    /**
     * Get task history
     */
    async getTaskHistory(options = {}) {
        const params = new URLSearchParams();
        
        if (options.toolType && options.toolType !== 'all') {
            params.append('tool_type', options.toolType);
        }
        
        if (options.limit) {
            params.append('limit', options.limit);
        }
        
        if (options.page) {
            params.append('page', options.page);
        }

        const endpoint = `/tasks/${params.toString() ? '?' + params.toString() : ''}`;
        return this.apiRequest(endpoint);
    }

    /**
     * Get user usage statistics
     */
    async getUserStats() {
        return this.apiRequest('/stats/');
    }

    /**
     * Poll task status until completion
     */
    async pollTaskStatus(taskId, onProgress = null, timeout = 120000) {
        const startTime = Date.now();
        const pollInterval = 2000; // 2 seconds

        return new Promise((resolve, reject) => {
            const poll = async () => {
                try {
                    // Check for timeout
                    if (Date.now() - startTime > timeout) {
                        reject(new Error('Task polling timeout'));
                        return;
                    }

                    const status = await this.getTaskStatus(taskId);
                    
                    // Call progress callback if provided
                    if (onProgress) {
                        onProgress(status);
                    }

                    // Check if task is complete
                    if (status.status === 'completed') {
                        resolve(status);
                        return;
                    } else if (status.status === 'failed') {
                        reject(new Error(status.error_message || 'Task failed'));
                        return;
                    } else if (status.status === 'cancelled') {
                        reject(new Error('Task was cancelled'));
                        return;
                    }

                    // Continue polling
                    setTimeout(poll, pollInterval);
                } catch (error) {
                    reject(error);
                }
            };

            // Start polling
            poll();
        });
    }

    /**
     * Humanize text and wait for completion
     */
    async humanizeTextAndWait(inputText, options = {}, onProgress = null) {
        try {
            // Create the task
            const createResponse = await this.humanizeText(inputText, options);
            const taskId = createResponse.task_id;

            console.log('Humanizer task created:', taskId);

            // Poll for completion
            const result = await this.pollTaskStatus(taskId, onProgress);
            
            return {
                taskId,
                outputText: result.output_text,
                processingTime: result.processing_time,
                status: result.status,
            };
        } catch (error) {
            console.error('Error in humanizeTextAndWait:', error);
            throw error;
        }
    }

    /**
     * Process text and wait for completion
     */
    async processTextAndWait(toolType, inputText, options = {}, onProgress = null) {
        try {
            // Create the task
            const createResponse = await this.processText(toolType, inputText, options);
            const taskId = createResponse.task_id;

            console.log('Task created:', taskId);

            // Poll for completion
            const result = await this.pollTaskStatus(taskId, onProgress);
            
            return {
                taskId,
                outputText: result.output_text,
                processingTime: result.processing_time,
                status: result.status,
            };
        } catch (error) {
            console.error('Error in processTextAndWait:', error);
            throw error;
        }
    }
}

// Create and export a singleton instance
const aiToolsApi = new AIToolsApiService();
export default aiToolsApi;
