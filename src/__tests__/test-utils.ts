/**
 * Typed test utilities for Grok API tests
 * Provides type-safe mock factories that match actual API response structures
 */
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'

import type { GrokAgentResponse, GrokChatResponse } from '../schemas.js'

// ============================================================================
// Mock Response Builders
// ============================================================================

export interface MockResponseOptions {
  content: string
  citations?: string[]
  model?: string
  inputTokens?: number
  outputTokens?: number
}

/**
 * Create a properly typed mock API response matching the /v1/responses format
 */
export function createMockAgentResponse(options: MockResponseOptions): GrokAgentResponse {
  const {
    content,
    citations = [],
    model = 'grok-4-1-fast',
    inputTokens = 10,
    outputTokens = 20,
  } = options

  const annotations = citations.map((url) => ({
    type: 'url_citation' as const,
    url,
    title: `Citation from ${new URL(url).hostname}`,
  }))

  return {
    id: `resp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    object: 'response' as const,
    created_at: Date.now(),
    completed_at: Date.now() + 1000,
    model,
    output: [
      {
        type: 'message' as const,
        id: `msg-${Date.now()}`,
        role: 'assistant',
        status: 'completed',
        content: [
          {
            type: 'output_text',
            text: content,
            annotations,
            logprobs: [],
          },
        ],
      },
    ],
    usage: {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: inputTokens + outputTokens,
    },
  }
}

/**
 * Create properly typed Axios response wrapper
 */
export function createAxiosResponse<T>(data: T, status = 200): AxiosResponse<T> {
  return {
    data,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: {},
    config: {
      headers: {},
    } as InternalAxiosRequestConfig,
  }
}

/**
 * Create a complete mock Axios response for successful API calls
 */
export function createMockAxiosResponse(
  options: MockResponseOptions
): AxiosResponse<GrokAgentResponse> {
  return createAxiosResponse(createMockAgentResponse(options))
}

// ============================================================================
// Error Response Builders
// ============================================================================

export interface MockErrorOptions {
  status: number
  message?: string
  code?: string
}

/**
 * Create a mock Axios error response
 */
export function createMockAxiosError(options: MockErrorOptions) {
  const { status, message = `Error ${status}`, code } = options

  const error = new Error(`Request failed with status code ${status}`) as Error & {
    isAxiosError: boolean
    response: {
      status: number
      data: { error: { message: string; code?: string } }
      statusText: string
      headers: Record<string, unknown>
      config: { headers: Record<string, unknown> }
    }
  }

  error.isAxiosError = true
  error.response = {
    status,
    data: { error: { message, code } },
    statusText: 'Error',
    headers: {},
    config: { headers: {} },
  }

  return error
}

// ============================================================================
// Response Assertions
// ============================================================================

/**
 * Assert that a normalized response has valid structure
 */
export function assertValidChatResponse(response: unknown): asserts response is GrokChatResponse {
  if (!response || typeof response !== 'object') {
    throw new Error('Response must be an object')
  }

  const r = response as Record<string, unknown>

  if (typeof r.id !== 'string') {
    throw new Error('Response must have string id')
  }

  if (typeof r.model !== 'string') {
    throw new Error('Response must have string model')
  }

  if (!Array.isArray(r.choices) || r.choices.length === 0) {
    throw new Error('Response must have non-empty choices array')
  }

  const choice = r.choices[0] as Record<string, unknown>
  if (!choice.message || typeof choice.message !== 'object') {
    throw new Error('Choice must have message object')
  }

  const message = choice.message as Record<string, unknown>
  if (typeof message.content !== 'string') {
    throw new Error('Message must have string content')
  }

  if (typeof message.role !== 'string') {
    throw new Error('Message must have string role')
  }
}

/**
 * Assert that response content is non-empty and meaningful
 */
export function assertNonEmptyContent(response: GrokChatResponse, minLength = 1): void {
  const content = response.choices[0]?.message?.content
  if (!content || content.trim().length < minLength) {
    throw new Error(`Expected content with at least ${minLength} characters, got: "${content}"`)
  }
}

/**
 * Assert that response has citations when expected
 */
export function assertHasCitations(response: GrokChatResponse, minCount = 1): void {
  if (!response.citations || response.citations.length < minCount) {
    throw new Error(
      `Expected at least ${minCount} citations, got: ${response.citations?.length ?? 0}`
    )
  }

  for (const citation of response.citations) {
    if (!citation.startsWith('http')) {
      throw new Error(`Invalid citation URL: ${citation}`)
    }
  }
}

/**
 * Assert that response has valid usage metadata
 */
export function assertHasUsage(response: GrokChatResponse): void {
  if (!response.usage) {
    throw new Error('Expected response to have usage metadata')
  }

  if (typeof response.usage.prompt_tokens !== 'number' || response.usage.prompt_tokens < 0) {
    throw new Error('Invalid prompt_tokens in usage')
  }

  if (
    typeof response.usage.completion_tokens !== 'number' ||
    response.usage.completion_tokens < 0
  ) {
    throw new Error('Invalid completion_tokens in usage')
  }

  if (typeof response.usage.total_tokens !== 'number' || response.usage.total_tokens < 0) {
    throw new Error('Invalid total_tokens in usage')
  }
}

// ============================================================================
// Content Type Assertions (for JSON responses)
// ============================================================================

/**
 * Parse and validate JSON content from response
 */
export function parseJsonContent<T>(response: GrokChatResponse): T {
  const content = response.choices[0]?.message?.content
  if (!content) {
    throw new Error('No content in response')
  }

  try {
    return JSON.parse(content) as T
  } catch {
    // Content might not be pure JSON, try to extract JSON from markdown
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]) as T
    }

    // Try to find JSON object in content
    const objectMatch = content.match(/\{[\s\S]*\}/)
    if (objectMatch) {
      return JSON.parse(objectMatch[0]) as T
    }

    throw new Error(`Failed to parse JSON from content: ${content.substring(0, 100)}...`)
  }
}

// ============================================================================
// Test Data Generators
// ============================================================================

/**
 * Generate realistic search posts response
 */
export function generateSearchPostsContent(): string {
  return JSON.stringify({
    summary: 'Active discussions about the topic with mixed sentiment',
    post_count: 42,
    themes: ['technology', 'innovation', 'future'],
    sentiment: {
      overall: 'mixed',
      distribution: '40% positive, 35% neutral, 25% negative',
      key_sentiment_words: ['exciting', 'concerning', 'promising'],
    },
    notable_points: ['Key observation 1', 'Key observation 2'],
    time_window: '4hr',
    data_freshness: new Date().toISOString(),
  })
}

/**
 * Generate realistic trends response
 */
export function generateTrendsContent(): string {
  return JSON.stringify({
    trends: [
      {
        topic: 'AI Innovation',
        description: 'Discussions about new AI breakthroughs',
        volume: 'high',
        sentiment: 'positive',
        key_themes: ['technology', 'future'],
      },
      {
        topic: 'Climate Action',
        description: 'Environmental policy discussions',
        volume: 'medium',
        sentiment: 'mixed',
        key_themes: ['environment', 'policy'],
      },
    ],
    analysis_time: new Date().toISOString(),
    data_source: 'X/Twitter',
  })
}
