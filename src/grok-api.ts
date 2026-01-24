import axios, { type AxiosError } from 'axios'

import { config, logger } from './config.js'
import {
  type GrokAgentRequest,
  type GrokAgentResponse,
  GrokAgentResponseSchema,
  type GrokChatResponse,
  GrokChatResponseSchema,
  type GrokErrorResponse,
  type XSearchTool,
} from './schemas.js'

// Re-export types for backwards compatibility
export type {
  GrokAgentRequest,
  GrokAgentResponse,
  GrokChatResponse,
  GrokErrorResponse,
  XSearchTool,
}

// New Agent Tools API endpoint (replaces deprecated chat/completions with search_parameters)
const GROK_API_BASE_URL = 'https://api.x.ai/v1/responses'
const MAX_RETRIES = 3
const RETRYABLE_STATUS_CODES = [429, 500, 502, 503, 504]

export class GrokApiError extends Error {
  public status: number
  public response?: GrokErrorResponse

  constructor(message: string, status: number, response?: GrokErrorResponse) {
    super(message)
    this.name = 'GrokApiError'
    this.status = status
    this.response = response
  }
}

export class GrokApiClient {
  private apiKey: string
  private baseUrl: string
  private defaultModel: string

  constructor(apiKey?: string, baseUrl?: string, defaultModel?: string) {
    // If apiKey is explicitly provided (even if empty), use it; otherwise use config
    this.apiKey = apiKey !== undefined ? apiKey : config.GROK_API_KEY || ''
    this.baseUrl = baseUrl || GROK_API_BASE_URL
    this.defaultModel = defaultModel || config.GROK_MODEL

    if (!this.apiKey || this.apiKey.trim() === '') {
      throw new Error('GROK_API_KEY is required')
    }
  }

  /**
   * Convert agent response to normalized chat response format
   */
  private normalizeResponse(agentResponse: GrokAgentResponse): GrokChatResponse {
    // Extract the final message content from the output array
    let content = ''
    const citations: string[] = []

    for (const output of agentResponse.output) {
      if (output.type === 'message') {
        // Handle the new content structure: array of content blocks
        if (Array.isArray(output.content)) {
          for (const block of output.content) {
            if (block.type === 'output_text' && block.text) {
              content += block.text
            }
            // Extract citations from annotations
            if (block.annotations && Array.isArray(block.annotations)) {
              for (const annotation of block.annotations) {
                if (annotation && typeof annotation === 'object') {
                  const ann = annotation as { type?: string; url?: string }
                  if (ann.type === 'url_citation' && ann.url) {
                    citations.push(ann.url)
                  }
                }
              }
            }
          }
        } else if (typeof output.content === 'string') {
          // Fallback for string content
          content += output.content
        }
      }
    }

    return {
      id: agentResponse.id,
      object: agentResponse.object,
      created: agentResponse.created_at || Date.now(),
      model: agentResponse.model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content,
          },
          finish_reason: 'stop',
        },
      ],
      usage: agentResponse.usage
        ? {
            prompt_tokens: agentResponse.usage.input_tokens,
            completion_tokens: agentResponse.usage.output_tokens,
            total_tokens: agentResponse.usage.total_tokens,
          }
        : undefined,
      citations: citations.length > 0 ? citations : undefined,
    }
  }

  /**
   * Make a request to Grok Agent Tools API with retry logic
   */
  async chat(request: GrokAgentRequest): Promise<GrokChatResponse> {
    const requestBody = {
      model: request.model || this.defaultModel,
      input: request.input,
      ...(request.tools && { tools: request.tools }),
      ...(request.temperature !== undefined && { temperature: request.temperature }),
      ...(request.max_tokens && { max_tokens: request.max_tokens }),
    }

    logger.debug(`Grok API request: ${JSON.stringify(requestBody).substring(0, 200)}...`)

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const response = await axios.post<GrokAgentResponse>(this.baseUrl, requestBody, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          timeout: 120000, // 120 second timeout for agent requests
        })

        logger.debug(`Grok API response: ${response.status}`)

        // Validate response against schema
        const parseResult = GrokAgentResponseSchema.safeParse(response.data)
        if (!parseResult.success) {
          logger.warn(`Response validation warning: ${parseResult.error.message}`)
          // Still proceed with response, but log validation issues
        }

        const normalizedResponse = this.normalizeResponse(response.data as GrokAgentResponse)

        // Validate normalized response
        const normalizedParseResult = GrokChatResponseSchema.safeParse(normalizedResponse)
        if (!normalizedParseResult.success) {
          throw new GrokApiError(
            `Invalid response structure: ${normalizedParseResult.error.message}`,
            0
          )
        }

        return normalizedResponse
      } catch (error) {
        if (axios.isAxiosError(error)) {
          const axiosError = error as AxiosError
          const status = axiosError.response?.status || 0

          // Check if we should retry
          if (RETRYABLE_STATUS_CODES.includes(status) && attempt < MAX_RETRIES - 1) {
            const delay = (attempt + 1) * 2000 // 2s, 4s, 6s
            logger.warn(
              `Grok API request failed with status ${status}, retrying in ${delay}ms... (attempt ${attempt + 1}/${MAX_RETRIES})`
            )
            await this.sleep(delay)
            continue
          }

          // Non-retryable error or max retries reached
          const errorMessage = axiosError.response?.data
            ? JSON.stringify(axiosError.response.data)
            : axiosError.message

          throw new GrokApiError(
            `Grok API request failed: ${errorMessage}`,
            status,
            axiosError.response?.data as GrokErrorResponse
          )
        }

        // Network or other error
        if (attempt < MAX_RETRIES - 1) {
          const delay = (attempt + 1) * 2000
          logger.warn(
            `Grok API request failed with network error, retrying in ${delay}ms... (attempt ${attempt + 1}/${MAX_RETRIES})`
          )
          await this.sleep(delay)
          continue
        }

        throw new GrokApiError(
          `Grok API request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          0
        )
      }
    }

    throw new GrokApiError('Grok API request failed after max retries', 0)
  }

  /**
   * Calculate date range from time window string
   */
  private getDateRange(timeWindow: string): { from_date?: string; to_date?: string } {
    const now = new Date()
    const to_date = now.toISOString().split('T')[0]

    let from: Date
    switch (timeWindow) {
      case '15min':
      case '1hr':
      case '4hr':
        // For short windows, default to today
        from = now
        break
      case '24hr':
        from = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        break
      case '7d':
        from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      default:
        from = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    }

    const from_date = from.toISOString().split('T')[0]
    return { from_date, to_date }
  }

  /**
   * Search and analyze X/Twitter posts about a topic
   */
  async searchPosts(
    query: string,
    options: {
      timeWindow?: string
      limit?: number
      analysisType?: 'sentiment' | 'themes' | 'both'
    } = {}
  ): Promise<GrokChatResponse> {
    const { timeWindow = '4hr', analysisType = 'both' } = options

    const analysisInstructions = {
      sentiment:
        'Focus on sentiment analysis: identify positive, negative, and neutral posts. Extract sentiment-bearing words and phrases.',
      themes:
        'Focus on thematic analysis: identify main topics, recurring themes, and discussion patterns.',
      both: 'Analyze both sentiment and themes: identify main topics, sentiment distribution, and key discussion patterns.',
    }[analysisType]

    const dateRange = this.getDateRange(timeWindow)

    const prompt = `Search X/Twitter and analyze recent posts about: ${query}

Time window: ${timeWindow}

${analysisInstructions}

Return a structured JSON analysis with:
{
  "summary": "Brief overview of the discussion",
  "post_count": "estimated number of posts analyzed",
  "themes": ["array", "of", "main", "themes"],
  "sentiment": {
    "overall": "positive/negative/neutral/mixed",
    "distribution": "description of sentiment distribution",
    "key_sentiment_words": ["array", "of", "sentiment", "words"]
  },
  "notable_points": ["array", "of", "key", "observations"],
  "time_window": "${timeWindow}",
  "data_freshness": "timestamp or description"
}

Only report what you observe in the posts. Include specific quotes where relevant.`

    return this.chat({
      input: [{ role: 'user', content: prompt }],
      tools: [
        {
          type: 'x_search',
          ...dateRange,
        },
      ],
      temperature: 0.3,
    })
  }

  /**
   * Analyze a topic with customizable analysis aspects
   */
  async analyzeTopic(
    topic: string,
    aspects: string[],
    options: {
      limit?: number
      timeWindow?: string
    } = {}
  ): Promise<GrokChatResponse> {
    const { timeWindow = '4hr' } = options

    const aspectsList = aspects.join(', ')
    const dateRange = this.getDateRange(timeWindow)

    const prompt = `Search X/Twitter and analyze posts about: ${topic}

Focus on these specific aspects: ${aspectsList}

Time window: ${timeWindow}

Provide a structured analysis addressing each aspect. For each aspect, include:
- Key observations from the posts
- Relevant quotes or data points
- Patterns or trends observed

Format your response as a structured JSON object with keys for each aspect.

Only report what you observe in the posts. Do not speculate or make recommendations.`

    return this.chat({
      input: [{ role: 'user', content: prompt }],
      tools: [
        {
          type: 'x_search',
          ...dateRange,
        },
      ],
      temperature: 0.3,
    })
  }

  /**
   * Get trending topics and discussions
   */
  async getTrends(
    options: {
      category?: string
      limit?: number
    } = {}
  ): Promise<GrokChatResponse> {
    const { category } = options

    const categoryText = category ? ` in the ${category} category` : ''

    const prompt = `Search X/Twitter and identify the trending topics and discussions right now${categoryText}.

Identify the top trending topics and provide a structured analysis:

{
  "trends": [
    {
      "topic": "name of the trend",
      "description": "what it's about",
      "volume": "high/medium/low or estimated post count",
      "sentiment": "overall sentiment",
      "key_themes": ["main", "themes"]
    }
  ],
  "analysis_time": "timestamp",
  "data_source": "X/Twitter"
}

Focus on current, active discussions. Include specific examples where relevant.`

    // Use today's date for trends
    const today = new Date().toISOString().split('T')[0]

    return this.chat({
      input: [{ role: 'user', content: prompt }],
      tools: [
        {
          type: 'x_search',
          from_date: today,
          to_date: today,
        },
      ],
      temperature: 0.3,
    })
  }

  /**
   * General chat with optional X/Twitter search
   */
  async generalChat(
    prompt: string,
    options: {
      enableSearch?: boolean
      searchLimit?: number
      temperature?: number
    } = {}
  ): Promise<GrokChatResponse> {
    const { enableSearch = false, temperature = 0.7 } = options

    // If search is enabled, include the x_search tool
    const tools: XSearchTool[] | undefined = enableSearch ? [{ type: 'x_search' }] : undefined

    return this.chat({
      input: [{ role: 'user', content: prompt }],
      tools,
      temperature,
    })
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

// Singleton instance (lazy initialization to avoid issues during testing)
let _grokApiInstance: GrokApiClient | null = null

export const grokApi = new Proxy({} as GrokApiClient, {
  get(_target, prop) {
    if (!_grokApiInstance) {
      _grokApiInstance = new GrokApiClient()
    }
    return (_grokApiInstance as unknown as Record<string, unknown>)[prop as string]
  },
})
