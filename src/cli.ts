#!/usr/bin/env node

import { Command } from 'commander'

import { validateEnv } from './config.js'
import { GrokApiClient, GrokApiError } from './grok-api.js'

// Validate environment on startup
validateEnv()

const grokApi = new GrokApiClient()

interface OutputOptions {
  format?: 'json' | 'text'
}

function formatOutput(data: unknown, options: OutputOptions = {}): string {
  if (options.format === 'text') {
    // For text format, try to extract the main content
    if (typeof data === 'object' && data !== null) {
      const obj = data as Record<string, unknown>
      if (obj.analysis) return String(obj.analysis)
      if (obj.trends) return String(obj.trends)
      if (obj.response) return String(obj.response)
    }
    return JSON.stringify(data, null, 2)
  }
  return JSON.stringify(data, null, 2)
}

async function handleError(error: unknown): Promise<void> {
  if (error instanceof GrokApiError) {
    console.error(
      JSON.stringify(
        {
          error: error.message,
          status: error.status,
          details: error.response,
        },
        null,
        2
      )
    )
  } else if (error instanceof Error) {
    console.error(JSON.stringify({ error: error.message }, null, 2))
  } else {
    console.error(JSON.stringify({ error: 'Unknown error' }, null, 2))
  }
  process.exit(1)
}

const program = new Command()

program
  .name('grok')
  .description('CLI for Grok AI - X/Twitter social intelligence')
  .version('1.0.0')
  .option('-f, --format <format>', 'Output format (json|text)', 'json')

// Search posts command
program
  .command('search <query>')
  .description('Search and analyze X/Twitter posts about a topic')
  .option('-t, --time-window <window>', 'Time window: 15min, 1hr, 4hr, 24hr, 7d', '4hr')
  .option('-l, --limit <number>', 'Max posts to analyze (1-50)', '50')
  .option('-a, --analysis <type>', 'Analysis type: sentiment, themes, both', 'both')
  .action(async (query: string, options) => {
    try {
      const response = await grokApi.searchPosts(query, {
        timeWindow: options.timeWindow,
        limit: parseInt(options.limit, 10),
        analysisType: options.analysis as 'sentiment' | 'themes' | 'both',
      })

      const result = {
        analysis: response.choices[0]?.message?.content || '',
        citations: response.citations || [],
        metadata: {
          model: response.model,
          usage: response.usage,
        },
      }

      console.log(formatOutput(result, { format: program.opts().format }))
    } catch (error) {
      await handleError(error)
    }
  })

// Analyze topic command
program
  .command('analyze <topic>')
  .description('Deep analysis of a topic with customizable aspects')
  .option(
    '-a, --aspects <aspects>',
    'Comma-separated aspects to analyze',
    'sentiment,volume trends,key influencers,emerging themes'
  )
  .option('-t, --time-window <window>', 'Time window for analysis', '4hr')
  .option('-l, --limit <number>', 'Max posts to analyze (1-50)', '50')
  .action(async (topic: string, options) => {
    try {
      const aspects = options.aspects.split(',').map((a: string) => a.trim())

      const response = await grokApi.analyzeTopic(topic, aspects, {
        timeWindow: options.timeWindow,
        limit: parseInt(options.limit, 10),
      })

      const result = {
        analysis: response.choices[0]?.message?.content || '',
        citations: response.citations || [],
        metadata: {
          model: response.model,
          usage: response.usage,
        },
      }

      console.log(formatOutput(result, { format: program.opts().format }))
    } catch (error) {
      await handleError(error)
    }
  })

// Get trends command
program
  .command('trends')
  .description('Get trending topics and discussions on X/Twitter')
  .option(
    '-c, --category <category>',
    'Category filter (technology, politics, sports, entertainment)'
  )
  .option('-l, --limit <number>', 'Max posts to analyze for trends (1-50)', '50')
  .action(async (options) => {
    try {
      const response = await grokApi.getTrends({
        category: options.category,
        limit: parseInt(options.limit, 10),
      })

      const result = {
        trends: response.choices[0]?.message?.content || '',
        citations: response.citations || [],
        metadata: {
          model: response.model,
          usage: response.usage,
        },
      }

      console.log(formatOutput(result, { format: program.opts().format }))
    } catch (error) {
      await handleError(error)
    }
  })

// Chat command
program
  .command('chat <prompt>')
  .description('General chat with Grok AI')
  .option('-s, --search', 'Enable X/Twitter search to ground response', false)
  .option('-l, --search-limit <number>', 'Max posts to search if search enabled (1-50)', '50')
  .option('--temperature <number>', 'Response creativity 0.0-1.0', '0.7')
  .action(async (prompt: string, options) => {
    try {
      const response = await grokApi.generalChat(prompt, {
        enableSearch: options.search,
        searchLimit: parseInt(options.searchLimit, 10),
        temperature: parseFloat(options.temperature),
      })

      const result = {
        response: response.choices[0]?.message?.content || '',
        citations: response.citations || [],
        metadata: {
          model: response.model,
          usage: response.usage,
          searchEnabled: options.search,
        },
      }

      console.log(formatOutput(result, { format: program.opts().format }))
    } catch (error) {
      await handleError(error)
    }
  })

// Parse and execute
program.parse()
