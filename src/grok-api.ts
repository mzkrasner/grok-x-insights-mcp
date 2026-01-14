import axios, { type AxiosError } from 'axios'

import { config, logger } from './config.js'

const GROK_API_BASE_URL = 'https://api.x.ai/v1/chat/completions'
const MAX_RETRIES = 3
const RETRYABLE_STATUS_CODES = [429, 500, 502, 503, 504]

export interface GrokErrorResponse {
  error?: {
    message?: string
    type?: string
    code?: string
  }
  [key: string]: unknown
}

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

export interface GrokMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface GrokSearchParameters {
  mode: 'on' | 'off'
  sources?: Array<{ type: 'x' }>
  return_citations?: boolean
  limit?: number
}

export interface GrokChatRequest {
  model?: string
  messages: GrokMessage[]
  search_parameters?: GrokSearchParameters
  temperature?: number
  max_tokens?: number
}

export interface GrokChatResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    message: {
      role: string
      content: string
    }
    finish_reason: string
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
  citations?: string[]
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
   * Make a chat completion request to Grok API with retry logic
   */
  async chat(request: GrokChatRequest): Promise<GrokChatResponse> {
    const requestBody = {
      model: request.model || this.defaultModel,
      messages: request.messages,
      ...(request.search_parameters && { search_parameters: request.search_parameters }),
      ...(request.temperature !== undefined && { temperature: request.temperature }),
      ...(request.max_tokens && { max_tokens: request.max_tokens }),
    }

    logger.debug(`Grok API request: ${JSON.stringify(requestBody).substring(0, 200)}...`)

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const response = await axios.post<GrokChatResponse>(this.baseUrl, requestBody, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          timeout: 60000, // 60 second timeout
        })

        logger.debug(`Grok API response: ${response.status}`)
        return response.data
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
    const {
      timeWindow = '4hr',
      limit = config.DEFAULT_SEARCH_LIMIT,
      analysisType = 'both',
    } = options

    const analysisInstructions = {
      sentiment:
        'Focus on sentiment analysis: identify positive, negative, and neutral posts. Extract sentiment-bearing words and phrases.',
      themes:
        'Focus on thematic analysis: identify main topics, recurring themes, and discussion patterns.',
      both: 'Analyze both sentiment and themes: identify main topics, sentiment distribution, and key discussion patterns.',
    }[analysisType]

    const prompt = `Analyze recent X/Twitter posts about: ${query}

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
      messages: [{ role: 'user', content: prompt }],
      search_parameters: {
        mode: 'on',
        sources: [{ type: 'x' }],
        return_citations: true,
        limit,
      },
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
    const { limit = config.DEFAULT_SEARCH_LIMIT, timeWindow = '4hr' } = options

    const aspectsList = aspects.join(', ')

    const prompt = `Analyze X/Twitter posts about: ${topic}

Focus on these specific aspects: ${aspectsList}

Time window: ${timeWindow}

Provide a structured analysis addressing each aspect. For each aspect, include:
- Key observations from the posts
- Relevant quotes or data points
- Patterns or trends observed

Format your response as a structured JSON object with keys for each aspect.

Only report what you observe in the posts. Do not speculate or make recommendations.`

    return this.chat({
      messages: [{ role: 'user', content: prompt }],
      search_parameters: {
        mode: 'on',
        sources: [{ type: 'x' }],
        return_citations: true,
        limit,
      },
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
    const { category, limit = config.DEFAULT_SEARCH_LIMIT } = options

    const categoryText = category ? ` in the ${category} category` : ''

    const prompt = `What are the trending topics and discussions on X/Twitter right now${categoryText}?

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

    return this.chat({
      messages: [{ role: 'user', content: prompt }],
      search_parameters: {
        mode: 'on',
        sources: [{ type: 'x' }],
        return_citations: true,
        limit,
      },
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
    const {
      enableSearch = false,
      searchLimit = config.DEFAULT_SEARCH_LIMIT,
      temperature = 0.7,
    } = options

    const searchParams = enableSearch
      ? {
          mode: 'on' as const,
          sources: [{ type: 'x' as const }],
          return_citations: true,
          limit: searchLimit,
        }
      : undefined

    return this.chat({
      messages: [{ role: 'user', content: prompt }],
      search_parameters: searchParams,
      temperature,
    })
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

// Singleton instance
export const grokApi = new GrokApiClient()
