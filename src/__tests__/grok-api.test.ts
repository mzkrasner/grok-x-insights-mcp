/**
 * Grok API Client - Unit Tests
 * Tests retry logic, error handling, and API methods with properly typed mocks
 */
import axios from 'axios'
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { GrokApiClient, GrokApiError } from '../grok-api.js'
import { GrokAgentRequestSchema, GrokChatResponseSchema } from '../schemas.js'
import {
  assertNonEmptyContent,
  assertValidChatResponse,
  createMockAxiosError,
  createMockAxiosResponse,
} from './test-utils.js'

// Mock axios with proper typing
vi.mock('axios')

// Cast to properly typed mocks
const mockedPost = axios.post as unknown as Mock
const mockedIsAxiosError = axios.isAxiosError as unknown as Mock

describe('GrokApiClient - Unit Tests', () => {
  let client: GrokApiClient
  const testApiKey = 'test-api-key-12345'

  beforeEach(() => {
    client = new GrokApiClient(testApiKey, undefined, 'grok-4-1-fast')
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Constructor', () => {
    it('throws error if no API key provided', () => {
      expect(() => new GrokApiClient('')).toThrow('GROK_API_KEY is required')
    })

    it('throws error if API key is only whitespace', () => {
      expect(() => new GrokApiClient('   ')).toThrow('GROK_API_KEY is required')
    })

    it('initializes with provided configuration', () => {
      const customClient = new GrokApiClient('custom-key', 'https://custom.api', 'grok-4-1-fast')
      expect(customClient).toBeInstanceOf(GrokApiClient)
    })

    it('accepts valid API key formats', () => {
      // xAI keys start with 'xai-'
      expect(() => new GrokApiClient('xai-abc123')).not.toThrow()
      // Also accept test keys
      expect(() => new GrokApiClient('test-key')).not.toThrow()
    })
  })

  describe('chat() - Request Validation', () => {
    it('sends properly structured request body', async () => {
      const mockResponse = createMockAxiosResponse({ content: 'Test response' })
      mockedPost.mockResolvedValueOnce(mockResponse)

      await client.chat({
        input: [{ role: 'user', content: 'test message' }],
        temperature: 0.5,
      })

      expect(mockedPost).toHaveBeenCalledTimes(1)
      const [url, body, config] = mockedPost.mock.calls[0]

      // Validate URL
      expect(url).toBe('https://api.x.ai/v1/responses')

      // Validate request body matches schema
      const parseResult = GrokAgentRequestSchema.safeParse(body)
      expect(parseResult.success).toBe(true)

      // Validate specific fields
      expect(body).toMatchObject({
        model: 'grok-4-1-fast',
        input: [{ role: 'user', content: 'test message' }],
        temperature: 0.5,
      })

      // Validate headers
      expect(config?.headers).toMatchObject({
        'Content-Type': 'application/json',
        Authorization: `Bearer ${testApiKey}`,
      })
    })

    it('includes tools array when x_search is enabled', async () => {
      const mockResponse = createMockAxiosResponse({ content: 'Search results' })
      mockedPost.mockResolvedValueOnce(mockResponse)

      await client.chat({
        input: [{ role: 'user', content: 'search query' }],
        tools: [{ type: 'x_search', from_date: '2026-01-01', to_date: '2026-01-24' }],
      })

      const [, body] = mockedPost.mock.calls[0]
      expect(body.tools).toEqual([
        { type: 'x_search', from_date: '2026-01-01', to_date: '2026-01-24' },
      ])
    })

    it('omits tools when not provided', async () => {
      const mockResponse = createMockAxiosResponse({ content: 'Response' })
      mockedPost.mockResolvedValueOnce(mockResponse)

      await client.chat({
        input: [{ role: 'user', content: 'simple chat' }],
      })

      const [, body] = mockedPost.mock.calls[0]
      expect(body.tools).toBeUndefined()
    })
  })

  describe('chat() - Response Validation', () => {
    it('returns properly normalized response', async () => {
      const mockResponse = createMockAxiosResponse({
        content: 'This is the response content',
        citations: ['https://x.com/user/status/123'],
        inputTokens: 50,
        outputTokens: 100,
      })
      mockedPost.mockResolvedValueOnce(mockResponse)

      const result = await client.chat({
        input: [{ role: 'user', content: 'test' }],
      })

      // Validate against schema
      const parseResult = GrokChatResponseSchema.safeParse(result)
      expect(parseResult.success).toBe(true)

      // Use typed assertions
      assertValidChatResponse(result)
      assertNonEmptyContent(result)

      // Verify structure
      expect(result.choices).toHaveLength(1)
      expect(result.choices[0].message.role).toBe('assistant')
      expect(result.choices[0].message.content).toBe('This is the response content')
      expect(result.citations).toContain('https://x.com/user/status/123')
      expect(result.usage).toEqual({
        prompt_tokens: 50,
        completion_tokens: 100,
        total_tokens: 150,
      })
    })

    it('handles response without citations', async () => {
      const mockResponse = createMockAxiosResponse({ content: 'No citations here' })
      mockedPost.mockResolvedValueOnce(mockResponse)

      const result = await client.chat({
        input: [{ role: 'user', content: 'test' }],
      })

      assertValidChatResponse(result)
      expect(result.citations).toBeUndefined()
    })
  })

  describe('chat() - Retry Logic', () => {
    const mockSuccess = createMockAxiosResponse({ content: 'Success after retry' })

    it('succeeds on first attempt without retry', async () => {
      mockedPost.mockResolvedValueOnce(mockSuccess)

      const result = await client.chat({
        input: [{ role: 'user', content: 'test' }],
      })

      assertValidChatResponse(result)
      expect(result.choices[0].message.content).toBe('Success after retry')
      expect(mockedPost).toHaveBeenCalledTimes(1)
    })

    it('retries on 429 rate limit and succeeds', async () => {
      mockedIsAxiosError.mockReturnValue(true)
      mockedPost
        .mockRejectedValueOnce(createMockAxiosError({ status: 429, message: 'Rate limited' }))
        .mockResolvedValueOnce(mockSuccess)

      const result = await client.chat({
        input: [{ role: 'user', content: 'test' }],
      })

      assertValidChatResponse(result)
      expect(mockedPost).toHaveBeenCalledTimes(2)
    }, 10000)

    it('retries on 500 server error and succeeds', async () => {
      mockedIsAxiosError.mockReturnValue(true)
      mockedPost
        .mockRejectedValueOnce(createMockAxiosError({ status: 500, message: 'Server error' }))
        .mockResolvedValueOnce(mockSuccess)

      const result = await client.chat({
        input: [{ role: 'user', content: 'test' }],
      })

      assertValidChatResponse(result)
      expect(mockedPost).toHaveBeenCalledTimes(2)
    }, 10000)

    it('retries on 502/503/504 gateway errors', async () => {
      mockedIsAxiosError.mockReturnValue(true)
      mockedPost
        .mockRejectedValueOnce(createMockAxiosError({ status: 502, message: 'Bad gateway' }))
        .mockRejectedValueOnce(
          createMockAxiosError({ status: 503, message: 'Service unavailable' })
        )
        .mockResolvedValueOnce(mockSuccess)

      const result = await client.chat({
        input: [{ role: 'user', content: 'test' }],
      })

      assertValidChatResponse(result)
      expect(mockedPost).toHaveBeenCalledTimes(3)
    }, 15000)

    it('fails after max retries with proper error', async () => {
      mockedIsAxiosError.mockReturnValue(true)
      mockedPost
        .mockRejectedValueOnce(createMockAxiosError({ status: 500, message: 'Error 1' }))
        .mockRejectedValueOnce(createMockAxiosError({ status: 500, message: 'Error 2' }))
        .mockRejectedValueOnce(createMockAxiosError({ status: 500, message: 'Error 3' }))

      await expect(client.chat({ input: [{ role: 'user', content: 'test' }] })).rejects.toThrow(
        GrokApiError
      )

      expect(mockedPost).toHaveBeenCalledTimes(3)
    }, 15000)

    it('does not retry on 400 bad request', async () => {
      mockedIsAxiosError.mockReturnValue(true)
      mockedPost.mockRejectedValueOnce(
        createMockAxiosError({ status: 400, message: 'Bad request' })
      )

      await expect(client.chat({ input: [{ role: 'user', content: 'test' }] })).rejects.toThrow(
        GrokApiError
      )

      expect(mockedPost).toHaveBeenCalledTimes(1)
    })

    it('does not retry on 401 unauthorized', async () => {
      mockedIsAxiosError.mockReturnValue(true)
      mockedPost.mockRejectedValueOnce(
        createMockAxiosError({ status: 401, message: 'Invalid API key' })
      )

      const error = await client
        .chat({ input: [{ role: 'user', content: 'test' }] })
        .catch((e) => e)

      expect(error).toBeInstanceOf(GrokApiError)
      expect(error.status).toBe(401)
      expect(mockedPost).toHaveBeenCalledTimes(1)
    })

    it('does not retry on 403 forbidden', async () => {
      mockedIsAxiosError.mockReturnValue(true)
      mockedPost.mockRejectedValueOnce(createMockAxiosError({ status: 403, message: 'Forbidden' }))

      await expect(client.chat({ input: [{ role: 'user', content: 'test' }] })).rejects.toThrow(
        GrokApiError
      )

      expect(mockedPost).toHaveBeenCalledTimes(1)
    })

    it('retries on network errors', async () => {
      mockedIsAxiosError.mockReturnValue(false) // Network errors aren't AxiosErrors
      mockedPost
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockSuccess)

      const result = await client.chat({
        input: [{ role: 'user', content: 'test' }],
      })

      assertValidChatResponse(result)
      expect(mockedPost).toHaveBeenCalledTimes(2)
    }, 10000)

    it('fails after max retries on persistent network errors', async () => {
      mockedIsAxiosError.mockReturnValue(false)
      mockedPost
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockRejectedValueOnce(new Error('ETIMEDOUT'))
        .mockRejectedValueOnce(new Error('ENOTFOUND'))

      const error = await client
        .chat({ input: [{ role: 'user', content: 'test' }] })
        .catch((e) => e)

      expect(error).toBeInstanceOf(GrokApiError)
      expect(error.message).toContain('ENOTFOUND')
      expect(mockedPost).toHaveBeenCalledTimes(3)
    }, 15000)
  })

  describe('searchPosts()', () => {
    it('sends request with x_search tool and date range', async () => {
      const mockResponse = createMockAxiosResponse({
        content: JSON.stringify({ summary: 'Test', themes: [] }),
        citations: ['https://x.com/test'],
      })
      mockedPost.mockResolvedValueOnce(mockResponse)

      const result = await client.searchPosts('test query', {
        timeWindow: '24hr',
        analysisType: 'sentiment',
      })

      assertValidChatResponse(result)
      expect(result.citations).toContain('https://x.com/test')

      const [, body] = mockedPost.mock.calls[0]

      // Verify tools array contains x_search
      expect(body.tools).toHaveLength(1)
      expect(body.tools[0].type).toBe('x_search')
      expect(body.tools[0].from_date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(body.tools[0].to_date).toMatch(/^\d{4}-\d{2}-\d{2}$/)

      // Verify prompt contains query and analysis type
      expect(body.input[0].content).toContain('test query')
      expect(body.input[0].content).toContain('sentiment')
      expect(body.temperature).toBe(0.3)
    })

    it('uses default time window of 4hr', async () => {
      const mockResponse = createMockAxiosResponse({ content: '{}' })
      mockedPost.mockResolvedValueOnce(mockResponse)

      await client.searchPosts('query')

      const [, body] = mockedPost.mock.calls[0]
      expect(body.input[0].content).toContain('4hr')
    })
  })

  describe('analyzeTopic()', () => {
    it('sends request with specified aspects', async () => {
      const mockResponse = createMockAxiosResponse({
        content: JSON.stringify({ sentiment: 'positive' }),
        citations: ['https://x.com/post1'],
      })
      mockedPost.mockResolvedValueOnce(mockResponse)

      const aspects = ['sentiment', 'volume', 'key influencers']
      const result = await client.analyzeTopic('cryptocurrency', aspects, {
        timeWindow: '7d',
      })

      assertValidChatResponse(result)

      const [, body] = mockedPost.mock.calls[0]
      expect(body.input[0].content).toContain('cryptocurrency')
      expect(body.input[0].content).toContain('sentiment, volume, key influencers')
      expect(body.input[0].content).toContain('7d')
      expect(body.tools[0].type).toBe('x_search')
    })
  })

  describe('getTrends()', () => {
    it('sends request with category filter', async () => {
      const mockResponse = createMockAxiosResponse({
        content: JSON.stringify({ trends: [] }),
      })
      mockedPost.mockResolvedValueOnce(mockResponse)

      await client.getTrends({ category: 'technology' })

      const [, body] = mockedPost.mock.calls[0]
      expect(body.input[0].content).toContain('technology')
      expect(body.tools[0].type).toBe('x_search')
    })

    it('uses today date for trends', async () => {
      const mockResponse = createMockAxiosResponse({ content: '{}' })
      mockedPost.mockResolvedValueOnce(mockResponse)

      await client.getTrends({})

      const [, body] = mockedPost.mock.calls[0]
      const today = new Date().toISOString().split('T')[0]
      expect(body.tools[0].from_date).toBe(today)
      expect(body.tools[0].to_date).toBe(today)
    })
  })

  describe('generalChat()', () => {
    it('sends request without tools when search disabled', async () => {
      const mockResponse = createMockAxiosResponse({ content: 'Hello!' })
      mockedPost.mockResolvedValueOnce(mockResponse)

      const result = await client.generalChat('Say hello')

      assertValidChatResponse(result)
      expect(result.choices[0].message.content).toBe('Hello!')

      const [, body] = mockedPost.mock.calls[0]
      expect(body.tools).toBeUndefined()
      expect(body.input[0].content).toBe('Say hello')
    })

    it('sends request with x_search tool when search enabled', async () => {
      const mockResponse = createMockAxiosResponse({
        content: 'People are saying...',
        citations: ['https://x.com/status/1'],
      })
      mockedPost.mockResolvedValueOnce(mockResponse)

      const result = await client.generalChat('What are people saying about AI?', {
        enableSearch: true,
        temperature: 0.5,
      })

      assertValidChatResponse(result)
      expect(result.citations).toBeDefined()

      const [, body] = mockedPost.mock.calls[0]
      expect(body.tools).toEqual([{ type: 'x_search' }])
      expect(body.temperature).toBe(0.5)
    })

    it('uses default temperature of 0.7', async () => {
      const mockResponse = createMockAxiosResponse({ content: 'Response' })
      mockedPost.mockResolvedValueOnce(mockResponse)

      await client.generalChat('Test')

      const [, body] = mockedPost.mock.calls[0]
      expect(body.temperature).toBe(0.7)
    })
  })
})
