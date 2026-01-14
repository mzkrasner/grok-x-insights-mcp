# AGENTS.md - AI Agent Guidelines

## Project Overview

**Grok X Insights MCP** (`grok-mcp`) provides real-time social intelligence from X/Twitter for AI assistants like Claude and Cursor — powered by Grok's live search capabilities instead of the expensive X API.

**Core capabilities:**
- Search and analyze X/Twitter posts about any topic
- Deep topic analysis with customizable aspects (influencers, sentiment, controversy, etc.)
- Trend identification with volume and sentiment metrics
- Grok chat grounded in live X/Twitter data

## Architecture

### Core Components

- **src/index.ts** - MCP server entry point with tool registration
- **src/grok-api.ts** - Grok API client with retry logic and rate limiting
- **src/config.ts** - Configuration management and logging

### Tool Definitions

1. **grok_search_posts** - Search and analyze posts about any topic
2. **grok_analyze_topic** - Deep analysis with customizable aspects
3. **grok_get_trends** - Identify trending topics and discussions
4. **grok_chat** - General chat with optional X/Twitter search

## Agent Workflow Requirements

**MANDATORY for all AI agents working in this repo:**

### 1. Use Planning Before Implementation

- Always create an explicit plan (high-level checklist or task breakdown) **before** editing code
- Use the `todo_write` tool to track tasks and progress
- Refine and update the plan as you discover new constraints

### 2. Commit Frequently with Passing Pre-Commit Hooks

- **NEVER** disable, bypass, or use `--no-verify`
- Fix issues reported by hooks before committing
- Make **small, focused commits** (one logical change per commit)
- Commit after each completed task, not at the end of all work

### 3. Verify All Checks Before Claiming Completion

Before marking work as complete, you **MUST** run and pass:

```bash
npm run lint           # ESLint
npm run type-check     # TypeScript (tsc --noEmit)
npm test               # All tests
npm run build          # Build
```

- Only claim completion when **all checks are green**

## Development Commands

```bash
# Install dependencies
npm install

# Development mode
npm run dev

# Build
npm run build

# Testing
npm test                # Run all tests
npm run test:watch      # Watch mode
npm run test:coverage   # Coverage report

# Quality checks
npm run lint            # ESLint
npm run lint:fix        # Auto-fix ESLint issues
npm run type-check      # TypeScript check
npm run format          # Format with Prettier
npm run format:check    # Check formatting
```

## Code Standards

### CRITICAL: No `any` Types

This is **non-negotiable**. The ESLint config enforces `@typescript-eslint/no-explicit-any: error`.

**Forbidden:**
```typescript
// ❌ Using any
function process(data: any) { ... }
const result: any = await fetch()
const items: any[] = []
```

**Required:**
```typescript
// ✅ Proper typing
function process(data: GrokChatRequest) { ... }
const result: GrokChatResponse = await fetch()
const items: GrokMessage[] = []

// ✅ Generic constraints
function process<T extends GrokMessage>(data: T) { ... }

// ✅ Unknown for truly unknown data
function process(data: unknown) {
  if (isValidData(data)) {
    // Type narrowed here
  }
}
```

### Type Safety

- No `any` types allowed - use proper types or `unknown`
- Explicit return types on all functions
- Strict null checks enabled
- Use Zod for runtime validation
- All error types properly defined

### Error Handling

- Use custom `GrokApiError` class for API errors
- Implement retry logic for rate limits (429) and server errors (5xx)
- Never swallow errors silently
- Log errors with context before rethrowing

### Testing

- Use Vitest for all tests
- Unit tests for logic (mocked axios)
- Integration tests for actual API calls (skipped if no API key)
- Test error scenarios and retry logic
- Aim for high coverage (80%+)

## Testing Patterns

### Unit Tests (Mocked)

```typescript
// Mock axios for unit tests
vi.mock('axios')
const mockedAxios = vi.mocked(axios, true)

// Setup mocks
mockedAxios.post.mockResolvedValueOnce(mockResponse)

// Test retry logic
it('retries on 429', async () => {
  mockedAxios.post
    .mockRejectedValueOnce(createErrorResponse(429))
    .mockResolvedValueOnce(mockSuccessResponse)

  const result = await client.chat({ messages: [...] })
  expect(mockedAxios.post).toHaveBeenCalledTimes(2)
})
```

### Integration Tests (Real API)

```typescript
// Skip if no API key
describe.skipIf(!process.env.GROK_API_KEY)('Integration Tests', () => {
  it('searches posts', async () => {
    const result = await client.searchPosts('AI', { limit: 20 })
    expect(result.choices).toBeDefined()
  }, 30000) // Longer timeout for API calls
})
```

## Environment Variables

```bash
# Required
GROK_API_KEY=your_grok_api_key_here

# Optional
GROK_MODEL=grok-4-fast              # Default model
DEFAULT_SEARCH_LIMIT=50             # Default post limit
LOG_LEVEL=info                      # Log level (error/warn/info/debug)
```

## Retry Logic

The Grok API client implements automatic retry with exponential backoff:

- **Retryable errors:** 429 (rate limit), 500, 502, 503, 504
- **Non-retryable errors:** 400 (bad request), 401 (unauthorized)
- **Max retries:** 3 attempts
- **Backoff:** 2s, 4s, 6s

## Code Conventions

- Use ES modules (`import`/`export`)
- Use `async`/`await` for async operations
- Use arrow functions for callbacks
- Use template literals for strings
- Use optional chaining (`?.`) and nullish coalescing (`??`)
- Import types with `type` keyword: `import { type Foo } from './foo.js'`
- Always use `.js` extension in imports for ESM compatibility

## MCP Integration

### Tool Structure

Each tool has:
- **name:** Unique identifier
- **description:** Human-readable description
- **inputSchema:** JSON Schema for parameters
- **execute:** Handler function

### Input Validation

Use Zod schemas to validate and parse tool arguments:

```typescript
const SearchPostsParams = z.object({
  query: z.string(),
  timeWindow: z.enum(['15min', '1hr', '4hr', '24hr', '7d']).optional(),
  limit: z.number().min(1).max(50).optional(),
})

const params = SearchPostsParams.parse(args)
```

### Response Format

Return JSON-stringified responses with metadata:

```typescript
return {
  content: [
    {
      type: 'text',
      text: JSON.stringify({
        analysis: response.choices[0]?.message?.content,
        citations: response.citations,
        metadata: { model, usage },
      }, null, 2),
    },
  ],
}
```

## Lessons Learned

### Always Test with Real API

Unit tests with mocks are not enough. Integration tests with the real Grok API are required to catch:
- Actual API response formats
- Rate limiting behavior
- Citation format
- Error messages

### Explicit Type Casting for Mocks

When using Vitest mocks with TypeScript strict mode:

```typescript
// ❌ Won't work with strict types
mockedAxios.post.mockResolvedValueOnce(...)

// ✅ Cast to any for mock methods
(mockedAxios.post as any).mockResolvedValueOnce(...)
```

### API Key in Environment

- Never hardcode API keys
- Always check for API key presence
- Fail fast if missing in production
- Skip integration tests if missing in CI

## Common Pitfalls

1. **Using `any` types** - Always define proper types
2. **Not testing retry logic** - Mock failures to test retries
3. **Forgetting to run linters** - Run checks before committing
4. **Not handling all error cases** - Test 4xx and 5xx responses
5. **Hardcoding configuration** - Use environment variables
6. **Skipping integration tests** - Test with real API when possible

## References

- [Grok API Documentation](https://console.x.ai/)
- [MCP SDK Documentation](https://modelcontextprotocol.io/)
- [Zod Documentation](https://zod.dev/)
- [Vitest Documentation](https://vitest.dev/)
