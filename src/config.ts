import dotenv from 'dotenv'

import { existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables
const envPath = join(__dirname, '..', '.env')
if (existsSync(envPath)) {
  dotenv.config({ path: envPath })
}

export interface Config {
  GROK_API_KEY?: string
  GROK_MODEL: string
  DEFAULT_SEARCH_LIMIT: number
  NODE_ENV: string
  LOG_LEVEL: string
}

export const config: Config = {
  GROK_API_KEY: process.env.GROK_API_KEY,
  GROK_MODEL: process.env.GROK_MODEL || 'grok-4-fast',
  DEFAULT_SEARCH_LIMIT: parseInt(process.env.DEFAULT_SEARCH_LIMIT || '50', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
}

export function validateEnv(): void {
  if (!config.GROK_API_KEY) {
    logger.error('GROK_API_KEY is not set in environment variables')
    logger.error('Please set GROK_API_KEY in your .env file')
    process.exit(1)
  }
}

// Simple logger
type LogLevel = 'error' | 'warn' | 'info' | 'debug'

class Logger {
  private level: LogLevel

  constructor(level: LogLevel = 'info') {
    this.level = level
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['error', 'warn', 'info', 'debug']
    return levels.indexOf(level) <= levels.indexOf(this.level)
  }

  private redact(text: string): string {
    // Redact API keys and sensitive data
    return text
      .replace(/Bearer [^\s]+/g, 'Bearer [REDACTED]')
      .replace(/api[_-]?key['":\s=]+[^\s'"]+/gi, 'api_key=[REDACTED]')
      .replace(/token['":\s=]+[^\s'"]+/gi, 'token=[REDACTED]')
  }

  error(message: string, ...args: unknown[]): void {
    if (this.shouldLog('error')) {
      console.error(`[ERROR] ${this.redact(message)}`, ...args)
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog('warn')) {
      console.warn(`[WARN] ${this.redact(message)}`, ...args)
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog('info')) {
      console.info(`[INFO] ${this.redact(message)}`, ...args)
    }
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog('debug')) {
      console.debug(`[DEBUG] ${this.redact(message)}`, ...args)
    }
  }
}

export const logger = new Logger(config.LOG_LEVEL as LogLevel)
