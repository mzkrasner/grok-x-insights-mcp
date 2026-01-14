/**
 * Grok API Client - Unit Tests
 * Tests retry logic, error handling, and API methods with mocked axios
 */
import axios, { type AxiosResponse } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { GrokApiClient, GrokApiError, type GrokChatResponse } from '../grok-api.js'

// Mock axios
vi.mock('axios')
const mockedAxios = vi.mocked(axios, true)

describe('GrokApiClient - Unit Tests', () => {
  let client: GrokApiClient
  const testApiKey = 'test-api-key'

  beforeEach(() => {
    client = new GrokApiClient(testApiKey, undefined, 'grok-4-fast')
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Constructor', () => {
    it('throws error if no API key provided', () => {
      expect(() => new GrokApiClient('')).toThrow('GROK_API_KEY is required')
    })

    it('initializes with provided configuration', () => {
      const customClient = new GrokApiClient('custom-key', 'https://custom.api', 'grok-4-plus')
      expect(customClient).toBeInstanceOf(GrokApiClient)
    })
  })

  describe('chat() - Retry Logic', () => {
    const mockSuccessResponse = {
      data: {
        id: 'test-id',
        object: 'chat.completion',
        created: Date.now(),
        model: 'grok-4-fast',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Test response',
            },
            finish_reason: 'stop',
          },
        ],
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: { headers: {} },
    } as AxiosResponse<GrokChatResponse>

    const createErrorResponse = (status: number) => {
      const error = new Error(`Request failed with status code ${status}`) as any
      error.isAxiosError = true
      error.response = {
        status,
        data: { error: { message: `Error ${status}` } },
        statusText: 'Error',
        headers: {},
        config: { headers: {} },
      }
      return error
    }

    it('succeeds on first attempt', async () => {
      ;(mockedAxios.post as any).mockResolvedValueOnce(mockSuccessResponse)

      const result = await client.chat({
        messages: [{ role: 'user', content: 'test' }],
      })

      expect(result).toEqual(mockSuccessResponse.data)
      expect(mockedAxios.post).toHaveBeenCalledTimes(1)
    })

    it('retries on 429 rate limit and succeeds', async () => {
      ;(mockedAxios.isAxiosError as any) = vi.fn(() => true)
      ;(mockedAxios.post as any)
        .mockRejectedValueOnce(createErrorResponse(429))
        .mockResolvedValueOnce(mockSuccessResponse)

      const result = await client.chat({
        messages: [{ role: 'user', content: 'test' }],
      })

      expect(result).toEqual(mockSuccessResponse.data)
      expect(mockedAxios.post).toHaveBeenCalledTimes(2)
    }, 10000)

    it('retries on 500 server error and succeeds', async () => {
      ;(mockedAxios.isAxiosError as any) = vi.fn(() => true)
      ;(mockedAxios.post as any)
        .mockRejectedValueOnce(createErrorResponse(500))
        .mockResolvedValueOnce(mockSuccessResponse)

      const result = await client.chat({
        messages: [{ role: 'user', content: 'test' }],
      })

      expect(result).toEqual(mockSuccessResponse.data)
      expect(mockedAxios.post).toHaveBeenCalledTimes(2)
    }, 10000)

    it('retries on 502/503/504 gateway errors', async () => {
      ;(mockedAxios.isAxiosError as any) = vi.fn(() => true)
      ;(mockedAxios.post as any)
        .mockRejectedValueOnce(createErrorResponse(502))
        .mockRejectedValueOnce(createErrorResponse(503))
        .mockResolvedValueOnce(mockSuccessResponse)

      const result = await client.chat({
        messages: [{ role: 'user', content: 'test' }],
      })

      expect(result).toEqual(mockSuccessResponse.data)
      expect(mockedAxios.post).toHaveBeenCalledTimes(3)
    }, 15000)

    it('fails after max retries', async () => {
      ;(mockedAxios.isAxiosError as any) = vi.fn(() => true)
      ;(mockedAxios.post as any)
        .mockRejectedValueOnce(createErrorResponse(500))
        .mockRejectedValueOnce(createErrorResponse(500))
        .mockRejectedValueOnce(createErrorResponse(500))

      await expect(
        client.chat({
          messages: [{ role: 'user', content: 'test' }],
        })
      ).rejects.toThrow(GrokApiError)

      expect(mockedAxios.post).toHaveBeenCalledTimes(3)
    }, 15000)

    it('does not retry on 400 bad request', async () => {
      const error400 = createErrorResponse(400)
      ;(mockedAxios.isAxiosError as any) = vi.fn(() => true)
      ;(mockedAxios.post as any).mockRejectedValueOnce(error400)

      await expect(
        client.chat({
          messages: [{ role: 'user', content: 'test' }],
        })
      ).rejects.toThrow(GrokApiError)

      expect(mockedAxios.post).toHaveBeenCalledTimes(1)
    })

    it('does not retry on 401 unauthorized', async () => {
      const error401 = createErrorResponse(401)
      ;(mockedAxios.isAxiosError as any) = vi.fn(() => true)
      ;(mockedAxios.post as any).mockRejectedValueOnce(error401)

      await expect(
        client.chat({
          messages: [{ role: 'user', content: 'test' }],
        })
      ).rejects.toThrow(GrokApiError)

      expect(mockedAxios.post).toHaveBeenCalledTimes(1)
    })

    it('retries on network errors', async () => {
      // Network errors are NOT AxiosErrors
      ;(mockedAxios.isAxiosError as any) = vi.fn(() => false)
      ;(mockedAxios.post as any)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockSuccessResponse)

      const result = await client.chat({
        messages: [{ role: 'user', content: 'test' }],
      })

      expect(result).toEqual(mockSuccessResponse.data)
      expect(mockedAxios.post).toHaveBeenCalledTimes(2)
    }, 10000)

    it('fails after max retries on persistent network errors', async () => {
      // Network errors are NOT AxiosErrors
      ;(mockedAxios.isAxiosError as any) = vi.fn(() => false)
      ;(mockedAxios.post as any)
        .mockRejectedValueOnce(new Error('Network error 1'))
        .mockRejectedValueOnce(new Error('Network error 2'))
        .mockRejectedValueOnce(new Error('Network error 3'))

      await expect(
        client.chat({
          messages: [{ role: 'user', content: 'test' }],
        })
      ).rejects.toThrow(GrokApiError)

      expect(mockedAxios.post).toHaveBeenCalledTimes(3)
    }, 15000)
  })

  describe('searchPosts()', () => {
    it('calls chat with correct parameters', async () => {
      const mockResponse = {
        data: {
          id: 'test-id',
          object: 'chat.completion',
          created: Date.now(),
          model: 'grok-4-fast',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: JSON.stringify({
                  summary: 'Test summary',
                  themes: ['theme1', 'theme2'],
                }),
              },
              finish_reason: 'stop',
            },
          ],
          citations: ['https://x.com/test'],
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { headers: {} },
      } as AxiosResponse<GrokChatResponse>

      ;(mockedAxios.post as any).mockResolvedValueOnce(mockResponse)

      const result = await client.searchPosts('test query', {
        timeWindow: '1hr',
        limit: 30,
        analysisType: 'sentiment',
      })

      expect(result).toEqual(mockResponse.data)
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining('test query'),
            }),
          ]),
          search_parameters: expect.objectContaining({
            mode: 'on',
            sources: [{ type: 'x' }],
            return_citations: true,
            limit: 30,
          }),
          temperature: 0.3,
        }),
        expect.any(Object)
      )
    })
  })

  describe('analyzeTopic()', () => {
    it('calls chat with correct parameters', async () => {
      const mockResponse = {
        data: {
          id: 'test-id',
          object: 'chat.completion',
          created: Date.now(),
          model: 'grok-4-fast',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: JSON.stringify({
                  sentiment: 'positive',
                  volume: 'high',
                }),
              },
              finish_reason: 'stop',
            },
          ],
          citations: ['https://x.com/test'],
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { headers: {} },
      } as AxiosResponse<GrokChatResponse>

      ;(mockedAxios.post as any).mockResolvedValueOnce(mockResponse)

      const result = await client.analyzeTopic(
        'test topic',
        ['sentiment', 'volume', 'influencers'],
        { limit: 40, timeWindow: '24hr' }
      )

      expect(result).toEqual(mockResponse.data)
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining('sentiment, volume, influencers'),
            }),
          ]),
          search_parameters: expect.objectContaining({
            mode: 'on',
            limit: 40,
          }),
        }),
        expect.any(Object)
      )
    })
  })

  describe('getTrends()', () => {
    it('calls chat with correct parameters', async () => {
      const mockResponse = {
        data: {
          id: 'test-id',
          object: 'chat.completion',
          created: Date.now(),
          model: 'grok-4-fast',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: JSON.stringify({
                  trends: [{ topic: 'trend1', volume: 'high' }],
                }),
              },
              finish_reason: 'stop',
            },
          ],
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { headers: {} },
      } as AxiosResponse<GrokChatResponse>

      ;(mockedAxios.post as any).mockResolvedValueOnce(mockResponse)

      const result = await client.getTrends({ category: 'technology', limit: 25 })

      expect(result).toEqual(mockResponse.data)
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('technology'),
            }),
          ]),
          search_parameters: expect.objectContaining({
            mode: 'on',
            limit: 25,
          }),
        }),
        expect.any(Object)
      )
    })
  })

  describe('generalChat()', () => {
    it('disables search by default', async () => {
      const mockResponse = {
        data: {
          id: 'test-id',
          object: 'chat.completion',
          created: Date.now(),
          model: 'grok-4-fast',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: 'Test response',
              },
              finish_reason: 'stop',
            },
          ],
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { headers: {} },
      } as AxiosResponse<GrokChatResponse>

      ;(mockedAxios.post as any).mockResolvedValueOnce(mockResponse)

      const result = await client.generalChat('Hello')

      expect(result).toEqual(mockResponse.data)
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.not.objectContaining({
          search_parameters: expect.anything(),
        }),
        expect.any(Object)
      )
    })

    it('enables search when requested', async () => {
      const mockResponse = {
        data: {
          id: 'test-id',
          object: 'chat.completion',
          created: Date.now(),
          model: 'grok-4-fast',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: 'Test response',
              },
              finish_reason: 'stop',
            },
          ],
          citations: ['https://x.com/test'],
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { headers: {} },
      } as AxiosResponse<GrokChatResponse>

      ;(mockedAxios.post as any).mockResolvedValueOnce(mockResponse)

      const result = await client.generalChat('Hello', {
        enableSearch: true,
        searchLimit: 20,
        temperature: 0.5,
      })

      expect(result).toEqual(mockResponse.data)
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          search_parameters: expect.objectContaining({
            mode: 'on',
            limit: 20,
          }),
          temperature: 0.5,
        }),
        expect.any(Object)
      )
    })
  })
})
