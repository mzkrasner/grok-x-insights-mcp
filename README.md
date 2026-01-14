# Grok X Insights MCP

Real-time social intelligence from X/Twitter for AI assistants — powered by Grok's live search capabilities instead of the expensive X API.

Search posts, analyze sentiment, track trends, and understand what the world is talking about.

## Features

- **Search & Analyze** — Query any topic and get structured analysis with themes, sentiment, and key observations
- **Deep Topic Analysis** — Customize what aspects to analyze (influencers, controversy, emerging trends, etc.)
- **Trend Detection** — Identify what's trending with volume metrics and sentiment breakdown
- **Grounded Chat** — Chat with Grok AI, optionally grounded in live X/Twitter data
- **Live Citations** — Every analysis includes source URLs from actual X/Twitter posts
- **Reliable** — Automatic retry with exponential backoff for rate limits
- **Type-Safe** — Full TypeScript with Zod validation

## Installation

```bash
npm install
```

## Configuration

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Add your Grok API key to `.env`:
```env
GROK_API_KEY=your_grok_api_key_here
```

Get your API key at: https://console.x.ai/

### Optional Configuration

```env
# Model to use (default: grok-4-fast)
GROK_MODEL=grok-4-fast

# Default search limit (default: 50)
DEFAULT_SEARCH_LIMIT=50

# Log level (default: info)
LOG_LEVEL=debug
```

## Usage

### Development Mode

```bash
npm run dev
```

### Production Build

```bash
npm run build
npm start
```

## Tools

### 1. grok_search_posts

Search and analyze X/Twitter posts about any topic.

**Parameters:**
- `query` (required): The search query or topic to analyze
- `timeWindow` (optional): Time window for analysis - "15min", "1hr", "4hr", "24hr", "7d" (default: "4hr")
- `limit` (optional): Maximum number of posts to analyze (1-50, default: 50)
- `analysisType` (optional): Type of analysis - "sentiment", "themes", "both" (default: "both")

**Example:**
```json
{
  "query": "artificial intelligence",
  "timeWindow": "4hr",
  "limit": 50,
  "analysisType": "both"
}
```

**Returns:**
```json
{
  "analysis": {
    "summary": "Brief overview",
    "post_count": "estimated count",
    "themes": ["theme1", "theme2"],
    "sentiment": {
      "overall": "positive/negative/neutral/mixed",
      "distribution": "description",
      "key_sentiment_words": ["word1", "word2"]
    },
    "notable_points": ["observation1", "observation2"]
  },
  "citations": ["url1", "url2"],
  "metadata": {
    "model": "grok-4-fast",
    "usage": {...}
  }
}
```

### 2. grok_analyze_topic

Perform deep analysis with customizable aspects.

**Parameters:**
- `topic` (required): The topic to analyze
- `aspects` (required): Array of aspects to analyze
- `timeWindow` (optional): Time window for analysis (default: "4hr")
- `limit` (optional): Maximum number of posts (1-50, default: 50)

**Example:**
```json
{
  "topic": "climate change",
  "aspects": [
    "sentiment trends",
    "key influencers",
    "controversy points",
    "emerging solutions"
  ],
  "timeWindow": "24hr"
}
```

### 3. grok_get_trends

Identify trending topics and discussions.

**Parameters:**
- `category` (optional): Category to filter trends (e.g., "technology", "politics")
- `limit` (optional): Maximum number of posts to analyze (1-50, default: 50)

**Example:**
```json
{
  "category": "technology",
  "limit": 50
}
```

**Returns:**
```json
{
  "trends": [
    {
      "topic": "trend name",
      "description": "what it's about",
      "volume": "high/medium/low",
      "sentiment": "overall sentiment",
      "key_themes": ["theme1", "theme2"]
    }
  ],
  "citations": ["url1", "url2"]
}
```

### 4. grok_chat

General chat with Grok AI, optionally grounded in X/Twitter data.

**Parameters:**
- `prompt` (required): Your message or question
- `enableSearch` (optional): Enable X/Twitter search (default: false)
- `searchLimit` (optional): Maximum posts to search if enabled (1-50, default: 50)
- `temperature` (optional): Response creativity 0.0-1.0 (default: 0.7)

**Example:**
```json
{
  "prompt": "What are people saying about SpaceX's latest launch?",
  "enableSearch": true,
  "searchLimit": 50,
  "temperature": 0.3
}
```

## Integration with Claude Desktop

Add to your Claude Desktop config file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "grok-x-insights": {
      "command": "node",
      "args": ["/absolute/path/to/grok-mcp/dist/index.js"],
      "env": {
        "GROK_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

## Architecture

### File Structure

```
grok-mcp/
├── src/
│   ├── index.ts        # MCP server entry point with tool handlers
│   ├── grok-api.ts     # Grok API client with retry logic
│   └── config.ts       # Configuration and logging
├── package.json
├── tsconfig.json
└── README.md
```

## Error Handling

The server implements comprehensive error handling:

- **Rate Limiting**: Automatic retry with exponential backoff (2s, 4s, 6s)
- **Network Errors**: Retry on connection failures
- **Validation Errors**: Zod schema validation with detailed error messages
- **API Errors**: Graceful handling with error details returned to client

## Development

### Running Tests

```bash
npm test
```

### Building

```bash
npm run build
```

### Logging

Set the `LOG_LEVEL` environment variable to control logging:

```env
LOG_LEVEL=debug  # error, warn, info, debug
```

## License

[MIT](LICENSE)
