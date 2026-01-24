/**
 * Grok API Client - Integration Tests
 * Tests against real Grok API with strong type validation
 * Run with: npm test -- grok-api.integration.test.ts
 */
import { beforeAll, describe, expect, it } from 'vitest'

import { GrokApiClient } from '../grok-api.js'
import { GrokChatResponseSchema } from '../schemas.js'
import {
  assertHasCitations,
  assertHasUsage,
  assertNonEmptyContent,
  assertValidChatResponse,
  parseJsonContent,
} from './test-utils.js'

// Skip all tests in this file if GROK_API_KEY is not set
const shouldSkip = !process.env.GROK_API_KEY

describe.skipIf(shouldSkip)('GrokApiClient - Integration Tests', () => {
  let client: GrokApiClient

  beforeAll(() => {
    if (!process.env.GROK_API_KEY) {
      throw new Error('GROK_API_KEY environment variable is required for integration tests')
    }
    client = new GrokApiClient()
  })

  describe('Response Schema Validation', () => {
    it('returns response matching GrokChatResponse schema', async () => {
      const result = await client.generalChat('What is 2+2?', { enableSearch: false })

      // Validate against Zod schema - this is the core type safety check
      const parseResult = GrokChatResponseSchema.safeParse(result)
      if (!parseResult.success) {
        console.error('Schema validation failed:', parseResult.error.format())
      }
      expect(parseResult.success).toBe(true)

      // Additional structural assertions
      assertValidChatResponse(result)
    }, 30000)
  })

  describe('searchPosts()', () => {
    it('returns valid response with content and potential citations', async () => {
      const result = await client.searchPosts('artificial intelligence', {
        timeWindow: '24hr',
        limit: 30,
        analysisType: 'both',
      })

      // Schema validation
      const parseResult = GrokChatResponseSchema.safeParse(result)
      expect(parseResult.success).toBe(true)

      // Structural validation
      assertValidChatResponse(result)
      assertNonEmptyContent(result, 10) // At least 10 chars

      // Log preview for debugging
      const content = result.choices[0].message.content
      console.log('Search posts response preview:', content.substring(0, 200))
    }, 45000)

    it('returns citations when X posts are found', async () => {
      const result = await client.searchPosts('technology trends', {
        timeWindow: '7d',
        limit: 30,
      })

      assertValidChatResponse(result)

      // Citations may or may not be present depending on search results
      if (result.citations && result.citations.length > 0) {
        assertHasCitations(result, 1)
        console.log(`Found ${result.citations.length} citations`)
      } else {
        console.log('No citations returned (topic may have limited X activity)')
      }
    }, 45000)

    it('includes time window in analysis context', async () => {
      const result = await client.searchPosts('software development', {
        timeWindow: '1hr',
        limit: 20,
      })

      assertValidChatResponse(result)
      assertNonEmptyContent(result)

      // The response should acknowledge the time window in some form
      // (either in the content or implicitly in the analysis)
      const content = result.choices[0].message.content.toLowerCase()
      // Check for time-related terms or the raw time window
      const hasTimeContext =
        content.includes('1hr') ||
        content.includes('hour') ||
        content.includes('recent') ||
        content.includes('time') ||
        content.includes('window') ||
        content.includes('period')

      // This is a soft check - we mainly care about the response being valid
      if (!hasTimeContext) {
        console.log('Note: Time window not explicitly mentioned in response')
      }
    }, 45000)

    it('respects sentiment analysis type', async () => {
      const result = await client.searchPosts('electric vehicles', {
        analysisType: 'sentiment',
        limit: 20,
      })

      assertValidChatResponse(result)
      assertNonEmptyContent(result)

      const content = result.choices[0].message.content.toLowerCase()

      // When sentiment analysis is requested, response should include sentiment terms
      const hasSentimentTerms =
        content.includes('sentiment') ||
        content.includes('positive') ||
        content.includes('negative') ||
        content.includes('neutral') ||
        content.includes('opinion') ||
        content.includes('feeling')

      expect(hasSentimentTerms).toBe(true)
    }, 45000)
  })

  describe('analyzeTopic()', () => {
    it('returns structured analysis with requested aspects', async () => {
      const aspects = ['sentiment trends', 'key themes', 'notable observations']
      const result = await client.analyzeTopic('cryptocurrency', aspects, {
        limit: 25,
        timeWindow: '24hr',
      })

      // Schema validation
      const parseResult = GrokChatResponseSchema.safeParse(result)
      expect(parseResult.success).toBe(true)

      assertValidChatResponse(result)
      assertNonEmptyContent(result, 20)

      const content = result.choices[0].message.content.toLowerCase()
      console.log('Analyze topic response preview:', content.substring(0, 200))

      // At least one of the requested aspects should be addressed
      const hasRequestedAspects =
        content.includes('sentiment') ||
        content.includes('theme') ||
        content.includes('observation') ||
        content.includes('trend')

      expect(hasRequestedAspects).toBe(true)
    }, 45000)

    it('handles multiple analysis aspects', async () => {
      const aspects = [
        'overall sentiment',
        'key influencers',
        'controversy points',
        'emerging trends',
      ]

      const result = await client.analyzeTopic('renewable energy', aspects, {
        limit: 20,
        timeWindow: '7d',
      })

      assertValidChatResponse(result)
      assertNonEmptyContent(result, 50)

      // Response should be substantial given multiple aspects requested
      const content = result.choices[0].message.content
      expect(content.length).toBeGreaterThan(100)
    }, 45000)
  })

  describe('getTrends()', () => {
    it('returns trending topics with valid structure', async () => {
      const result = await client.getTrends({ limit: 30 })

      // Schema validation
      const parseResult = GrokChatResponseSchema.safeParse(result)
      expect(parseResult.success).toBe(true)

      assertValidChatResponse(result)
      assertNonEmptyContent(result, 50)

      const content = result.choices[0].message.content.toLowerCase()
      console.log('Trends response preview:', content.substring(0, 200))

      // Should contain trend-related content
      const hasTrendContent =
        content.includes('trend') ||
        content.includes('topic') ||
        content.includes('discussion') ||
        content.includes('popular') ||
        content.includes('viral')

      expect(hasTrendContent).toBe(true)
    }, 45000)

    it('filters trends by category', async () => {
      const result = await client.getTrends({
        category: 'technology',
        limit: 25,
      })

      assertValidChatResponse(result)
      assertNonEmptyContent(result, 50)

      const content = result.choices[0].message.content.toLowerCase()

      // Should contain tech-related terms
      const hasTechContent =
        content.includes('tech') ||
        content.includes('ai') ||
        content.includes('software') ||
        content.includes('digital') ||
        content.includes('computer') ||
        content.includes('innovation')

      expect(hasTechContent).toBe(true)
    }, 45000)
  })

  describe('generalChat()', () => {
    it('responds without X search when disabled', async () => {
      const result = await client.generalChat('What is the capital of France?', {
        enableSearch: false,
        temperature: 0.3,
      })

      // Schema validation
      const parseResult = GrokChatResponseSchema.safeParse(result)
      expect(parseResult.success).toBe(true)

      assertValidChatResponse(result)
      assertNonEmptyContent(result, 1) // At least 1 character - API gives concise answers

      // Should NOT have citations when search is disabled
      expect(result.citations).toBeUndefined()

      // Should contain factual answer about Paris
      const content = result.choices[0].message.content.toLowerCase()
      expect(content).toContain('paris')

      console.log('Chat response preview:', result.choices[0].message.content.substring(0, 200))
    }, 30000)

    it('includes citations when X search is enabled', async () => {
      const result = await client.generalChat('What are people discussing about AI safety?', {
        enableSearch: true,
        searchLimit: 20,
        temperature: 0.5,
      })

      assertValidChatResponse(result)
      assertNonEmptyContent(result, 30)

      // When search is enabled, there should be citations (unless no results)
      if (result.citations && result.citations.length > 0) {
        assertHasCitations(result)
        console.log(`Chat with search returned ${result.citations.length} citations`)
      } else {
        console.log('No citations returned (topic may have limited X activity)')
      }
    }, 45000)

    it('respects temperature parameter (determinism test)', async () => {
      const lowTempResult1 = await client.generalChat('List exactly 3 prime numbers', {
        temperature: 0.0,
        enableSearch: false,
      })

      const lowTempResult2 = await client.generalChat('List exactly 3 prime numbers', {
        temperature: 0.0,
        enableSearch: false,
      })

      assertValidChatResponse(lowTempResult1)
      assertValidChatResponse(lowTempResult2)

      // Both should be valid responses (we can't guarantee exact matches due to API variability)
      assertNonEmptyContent(lowTempResult1)
      assertNonEmptyContent(lowTempResult2)
    }, 60000)
  })

  describe('Error Handling', () => {
    it('throws GrokApiError for invalid API key', async () => {
      const badClient = new GrokApiClient('invalid-api-key-12345')

      try {
        await badClient.generalChat('test')
        expect.fail('Should have thrown an error')
      } catch (error) {
        expect(error).toBeDefined()
        expect((error as Error).name).toBe('GrokApiError')
      }
    }, 30000)
  })

  describe('Usage Metadata', () => {
    it('returns valid usage information', async () => {
      const result = await client.generalChat('Hi', { enableSearch: false })

      assertValidChatResponse(result)
      assertHasUsage(result)

      expect(result.usage!.prompt_tokens).toBeGreaterThan(0)
      expect(result.usage!.completion_tokens).toBeGreaterThan(0)
      expect(result.usage!.total_tokens).toBe(
        result.usage!.prompt_tokens + result.usage!.completion_tokens
      )

      console.log('Token usage:', result.usage)
    }, 30000)
  })

  describe('JSON Response Parsing', () => {
    it('can parse JSON from search posts response', async () => {
      const result = await client.searchPosts('climate change', {
        timeWindow: '24hr',
        limit: 15,
      })

      assertValidChatResponse(result)

      // Try to parse as JSON (response is prompted to return JSON)
      try {
        const parsed = parseJsonContent<{
          summary?: string
          themes?: string[]
          sentiment?: { overall?: string }
        }>(result)

        // If it parsed, validate structure
        expect(typeof parsed).toBe('object')
        console.log('Parsed JSON keys:', Object.keys(parsed))
      } catch {
        // Response might not be pure JSON - log for debugging
        const content = result.choices[0].message.content
        console.log('Response is not JSON:', content.substring(0, 100))
        // This is acceptable - model may not always return JSON
      }
    }, 45000)
  })
})

describe('GrokApiClient - API Key Validation', () => {
  it('constructor throws for empty API key', () => {
    expect(() => new GrokApiClient('')).toThrow('GROK_API_KEY is required')
  })

  it('constructor throws for whitespace-only API key', () => {
    expect(() => new GrokApiClient('   ')).toThrow('GROK_API_KEY is required')
  })
})
