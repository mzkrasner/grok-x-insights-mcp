#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'

import { config, logger, validateEnv } from './config.js'
import { GrokApiError, grokApi } from './grok-api.js'

// Validate environment on startup
validateEnv()

// Tool definitions
const tools: Tool[] = [
  {
    name: 'grok_search_posts',
    description:
      'Search and analyze X/Twitter posts about any topic. Returns structured analysis with themes, sentiment, and citations.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'The search query or topic to analyze (e.g., "artificial intelligence", "climate change", "Tesla")',
        },
        timeWindow: {
          type: 'string',
          description: 'Time window for analysis: "15min", "1hr", "4hr", "24hr", "7d"',
          enum: ['15min', '1hr', '4hr', '24hr', '7d'],
          default: '4hr',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of posts to analyze (1-50)',
          minimum: 1,
          maximum: 50,
          default: 50,
        },
        analysisType: {
          type: 'string',
          description: 'Type of analysis to perform',
          enum: ['sentiment', 'themes', 'both'],
          default: 'both',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'grok_analyze_topic',
    description:
      'Perform deep analysis of a topic with customizable aspects. Allows you to specify exactly what aspects to analyze (e.g., sentiment, volume, key influencers, emerging trends).',
    inputSchema: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: 'The topic to analyze',
        },
        aspects: {
          type: 'array',
          items: {
            type: 'string',
          },
          description:
            'Array of aspects to analyze (e.g., ["sentiment", "volume trends", "key influencers", "emerging themes", "controversy points"])',
        },
        timeWindow: {
          type: 'string',
          description: 'Time window for analysis',
          default: '4hr',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of posts to analyze (1-50)',
          minimum: 1,
          maximum: 50,
          default: 50,
        },
      },
      required: ['topic', 'aspects'],
    },
  },
  {
    name: 'grok_get_trends',
    description:
      'Identify trending topics and discussions on X/Twitter. Returns current trends with volume metrics and sentiment.',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description:
            'Optional category to filter trends (e.g., "technology", "politics", "sports", "entertainment")',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of posts to analyze for trends (1-50)',
          minimum: 1,
          maximum: 50,
          default: 50,
        },
      },
      required: [],
    },
  },
  {
    name: 'grok_chat',
    description:
      'General chat with Grok AI. Optionally enable X/Twitter search to ground responses in current discussions.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'Your message or question to Grok',
        },
        enableSearch: {
          type: 'boolean',
          description: 'Enable X/Twitter search to ground the response in current posts',
          default: false,
        },
        searchLimit: {
          type: 'number',
          description: 'Maximum number of posts to search if enableSearch is true (1-50)',
          minimum: 1,
          maximum: 50,
          default: 50,
        },
        temperature: {
          type: 'number',
          description:
            'Response creativity (0.0-1.0). Lower is more focused, higher is more creative.',
          minimum: 0.0,
          maximum: 1.0,
          default: 0.7,
        },
      },
      required: ['prompt'],
    },
  },
]

// Zod schemas for input validation
const SearchPostsParams = z.object({
  query: z.string(),
  timeWindow: z.enum(['15min', '1hr', '4hr', '24hr', '7d']).optional().default('4hr'),
  limit: z.number().min(1).max(50).optional().default(50),
  analysisType: z.enum(['sentiment', 'themes', 'both']).optional().default('both'),
})

const AnalyzeTopicParams = z.object({
  topic: z.string(),
  aspects: z.array(z.string()),
  timeWindow: z.string().optional().default('4hr'),
  limit: z.number().min(1).max(50).optional().default(50),
})

const GetTrendsParams = z.object({
  category: z.string().optional(),
  limit: z.number().min(1).max(50).optional().default(50),
})

const ChatParams = z.object({
  prompt: z.string(),
  enableSearch: z.boolean().optional().default(false),
  searchLimit: z.number().min(1).max(50).optional().default(50),
  temperature: z.number().min(0).max(1).optional().default(0.7),
})

// Create MCP server
const server = new Server(
  {
    name: 'grok-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
)

// Register handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  logger.debug('Received ListTools request')
  return { tools }
})

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params
  logger.info(`Tool called: ${name}`)

  try {
    switch (name) {
      case 'grok_search_posts': {
        const params = SearchPostsParams.parse(args)
        const response = await grokApi.searchPosts(params.query, {
          timeWindow: params.timeWindow,
          limit: params.limit,
          analysisType: params.analysisType,
        })

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  analysis: response.choices[0]?.message?.content || '',
                  citations: response.citations || [],
                  metadata: {
                    model: response.model,
                    usage: response.usage,
                  },
                },
                null,
                2
              ),
            },
          ],
        }
      }

      case 'grok_analyze_topic': {
        const params = AnalyzeTopicParams.parse(args)
        const response = await grokApi.analyzeTopic(params.topic, params.aspects, {
          limit: params.limit,
          timeWindow: params.timeWindow,
        })

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  analysis: response.choices[0]?.message?.content || '',
                  citations: response.citations || [],
                  metadata: {
                    model: response.model,
                    usage: response.usage,
                  },
                },
                null,
                2
              ),
            },
          ],
        }
      }

      case 'grok_get_trends': {
        const params = GetTrendsParams.parse(args)
        const response = await grokApi.getTrends({
          category: params.category,
          limit: params.limit,
        })

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  trends: response.choices[0]?.message?.content || '',
                  citations: response.citations || [],
                  metadata: {
                    model: response.model,
                    usage: response.usage,
                  },
                },
                null,
                2
              ),
            },
          ],
        }
      }

      case 'grok_chat': {
        const params = ChatParams.parse(args)
        const response = await grokApi.generalChat(params.prompt, {
          enableSearch: params.enableSearch,
          searchLimit: params.searchLimit,
          temperature: params.temperature,
        })

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  response: response.choices[0]?.message?.content || '',
                  citations: response.citations || [],
                  metadata: {
                    model: response.model,
                    usage: response.usage,
                    searchEnabled: params.enableSearch,
                  },
                },
                null,
                2
              ),
            },
          ],
        }
      }

      default:
        throw new Error(`Unknown tool: ${name}`)
    }
  } catch (error) {
    if (error instanceof GrokApiError) {
      logger.error(`Grok API error: ${error.message} (status: ${error.status})`)
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                error: error.message,
                status: error.status,
                details: error.response,
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      }
    }

    if (error instanceof z.ZodError) {
      logger.error(`Validation error: ${error.message}`)
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                error: 'Invalid parameters',
                details: error.errors,
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      }
    }

    logger.error(`Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              error: error instanceof Error ? error.message : 'Unknown error',
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    }
  }
})

// Start server
async function main() {
  logger.info('Starting Grok MCP server...')
  logger.info(`Using model: ${config.GROK_MODEL}`)
  logger.info(`Default search limit: ${config.DEFAULT_SEARCH_LIMIT}`)

  const transport = new StdioServerTransport()
  await server.connect(transport)

  logger.info('Grok MCP server running on stdio')
}

main().catch((error) => {
  logger.error(`Fatal error: ${error instanceof Error ? error.message : 'Unknown error'}`)
  process.exit(1)
})
