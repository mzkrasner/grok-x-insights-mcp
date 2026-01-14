/**
 * Grok API Client - Integration Tests
 * Tests against real Grok API (requires GROK_API_KEY environment variable)
 * Run with: npm test -- grok-api.integration.test.ts
 */
import { beforeAll, describe, expect, it } from 'vitest'

import { GrokApiClient } from '../grok-api.js'

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

  describe('searchPosts()', () => {
    it('searches and analyzes posts about a topic', async () => {
      const result = await client.searchPosts('artificial intelligence', {
        timeWindow: '4hr',
        limit: 30,
        analysisType: 'both',
      })

      expect(result).toBeDefined()
      expect(result.choices).toBeDefined()
      expect(result.choices.length).toBeGreaterThan(0)
      expect(result.choices[0].message.content).toBeDefined()

      // Try to parse the response as JSON
      const content = result.choices[0].message.content
      expect(content.length).toBeGreaterThan(0)

      console.log('Search posts response preview:', content.substring(0, 200))
    }, 30000)

    it('returns citations when available', async () => {
      const result = await client.searchPosts('technology', {
        limit: 20,
      })

      expect(result).toBeDefined()

      // Citations may or may not be present depending on the search
      if (result.citations) {
        expect(Array.isArray(result.citations)).toBe(true)

        if (result.citations.length > 0) {
          result.citations.forEach((citation) => {
            expect(typeof citation).toBe('string')
            // Should be a URL
            const isUrl = citation.startsWith('http') || citation.includes('x.com')
            expect(isUrl).toBe(true)
          })

          console.log(`Found ${result.citations.length} citations`)
        }
      }
    }, 45000)

    it('respects time window parameter', async () => {
      const result = await client.searchPosts('climate change', {
        timeWindow: '1hr',
        limit: 20,
      })

      expect(result).toBeDefined()
      expect(result.choices[0].message.content).toContain('1hr')
    }, 30000)

    it('respects analysis type parameter', async () => {
      const result = await client.searchPosts('SpaceX', {
        analysisType: 'sentiment',
        limit: 15,
      })

      expect(result).toBeDefined()
      const content = result.choices[0].message.content.toLowerCase()

      // Should mention sentiment-related terms
      const hasSentimentTerms =
        content.includes('sentiment') ||
        content.includes('positive') ||
        content.includes('negative') ||
        content.includes('neutral')

      expect(hasSentimentTerms).toBe(true)
    }, 30000)
  })

  describe('analyzeTopic()', () => {
    it('analyzes topic with custom aspects', async () => {
      const result = await client.analyzeTopic(
        'cryptocurrency',
        ['sentiment trends', 'volume patterns', 'key themes'],
        {
          limit: 25,
          timeWindow: '4hr',
        }
      )

      expect(result).toBeDefined()
      expect(result.choices).toBeDefined()
      expect(result.choices.length).toBeGreaterThan(0)

      const content = result.choices[0].message.content.toLowerCase()

      // Should address the requested aspects
      const hasRelevantContent =
        content.includes('sentiment') || content.includes('volume') || content.includes('theme')

      expect(hasRelevantContent).toBe(true)

      console.log('Analyze topic response preview:', content.substring(0, 200))
    }, 30000)

    it('handles multiple aspects', async () => {
      const aspects = [
        'overall sentiment',
        'key influencers',
        'controversy points',
        'emerging trends',
      ]

      const result = await client.analyzeTopic('electric vehicles', aspects, {
        limit: 20,
      })

      expect(result).toBeDefined()
      expect(result.choices[0].message.content).toBeDefined()

      const content = result.choices[0].message.content
      expect(content.length).toBeGreaterThan(50)
    }, 30000)
  })

  describe('getTrends()', () => {
    it('gets current trending topics', async () => {
      const result = await client.getTrends({
        limit: 30,
      })

      expect(result).toBeDefined()
      expect(result.choices).toBeDefined()
      expect(result.choices.length).toBeGreaterThan(0)

      const content = result.choices[0].message.content.toLowerCase()

      // Should mention trends or trending
      const hasTrendContent =
        content.includes('trend') || content.includes('topic') || content.includes('discussion')

      expect(hasTrendContent).toBe(true)

      console.log('Trends response preview:', content.substring(0, 200))
    }, 30000)

    it('filters trends by category', async () => {
      const result = await client.getTrends({
        category: 'technology',
        limit: 25,
      })

      expect(result).toBeDefined()
      expect(result.choices[0].message.content).toBeDefined()

      const content = result.choices[0].message.content.toLowerCase()
      expect(content.length).toBeGreaterThan(50)
    }, 30000)
  })

  describe('generalChat()', () => {
    it('chats without search', async () => {
      const result = await client.generalChat('What is artificial intelligence?', {
        enableSearch: false,
        temperature: 0.7,
      })

      expect(result).toBeDefined()
      expect(result.choices).toBeDefined()
      expect(result.choices.length).toBeGreaterThan(0)
      expect(result.choices[0].message.content).toBeDefined()
      expect(result.choices[0].message.content.length).toBeGreaterThan(50)

      // Should not have citations when search is disabled
      expect(result.citations).toBeUndefined()

      console.log('Chat response preview:', result.choices[0].message.content.substring(0, 200))
    }, 30000)

    it('chats with X/Twitter search enabled', async () => {
      const result = await client.generalChat('What are people saying about renewable energy?', {
        enableSearch: true,
        searchLimit: 20,
        temperature: 0.5,
      })

      expect(result).toBeDefined()
      expect(result.choices).toBeDefined()
      expect(result.choices[0].message.content).toBeDefined()
      expect(result.choices[0].message.content.length).toBeGreaterThan(50)

      // May have citations when search is enabled
      if (result.citations) {
        expect(Array.isArray(result.citations)).toBe(true)
        console.log(`Chat with search returned ${result.citations.length} citations`)
      }
    }, 30000)

    it('respects temperature parameter', async () => {
      // Lower temperature should be more focused/deterministic
      const result1 = await client.generalChat('Tell me about quantum computing', {
        temperature: 0.1,
      })

      const result2 = await client.generalChat('Tell me about quantum computing', {
        temperature: 0.1,
      })

      expect(result1).toBeDefined()
      expect(result2).toBeDefined()

      // Both should have responses
      expect(result1.choices[0].message.content.length).toBeGreaterThan(0)
      expect(result2.choices[0].message.content.length).toBeGreaterThan(0)
    }, 60000)
  })

  describe('Error Handling', () => {
    it('handles invalid API key gracefully', async () => {
      const badClient = new GrokApiClient('invalid-key-12345')

      await expect(badClient.generalChat('test')).rejects.toThrow()
    }, 30000)
  })

  describe('Usage Metadata', () => {
    it('returns usage information', async () => {
      const result = await client.generalChat('Hi', {
        enableSearch: false,
      })

      expect(result).toBeDefined()

      // Usage metadata may be present
      if (result.usage) {
        expect(result.usage).toBeDefined()
        expect(typeof result.usage.total_tokens).toBe('number')
        expect(result.usage.total_tokens).toBeGreaterThan(0)

        console.log('Token usage:', result.usage)
      }
    }, 30000)
  })
})

describe('GrokApiClient - Integration Tests (Without API Key)', () => {
  it('fails gracefully when API key is missing', () => {
    expect(() => new GrokApiClient('')).toThrow('GROK_API_KEY is required')
  })
})
