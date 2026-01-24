/**
 * Zod schemas for Grok API request/response validation
 * These provide runtime type safety and can be used in both production code and tests
 */
import { z } from 'zod'

// ============================================================================
// Request Schemas
// ============================================================================

export const XSearchToolSchema = z.object({
  type: z.literal('x_search'),
  allowed_x_handles: z.array(z.string()).optional(),
  excluded_x_handles: z.array(z.string()).optional(),
  from_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  enable_image_understanding: z.boolean().optional(),
})

export const GrokRequestInputSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string(),
})

export const GrokAgentRequestSchema = z.object({
  model: z.string().optional(),
  input: z.array(GrokRequestInputSchema).min(1),
  tools: z.array(XSearchToolSchema).optional(),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().positive().optional(),
})

// ============================================================================
// Response Schemas
// ============================================================================

// Annotation in output text (citations, etc.)
export const AnnotationSchema = z
  .object({
    type: z.string(),
    url: z.string().optional(),
    title: z.string().optional(),
  })
  .passthrough() // Allow additional fields

// Content block in output message
export const OutputContentSchema = z
  .object({
    type: z.string(),
    text: z.string().optional(),
    annotations: z.array(AnnotationSchema).optional(),
    logprobs: z.array(z.unknown()).optional(),
  })
  .passthrough()

// Single output item (message, tool_use, tool_result, custom_tool_call)
export const OutputItemSchema = z.object({
  type: z.enum(['message', 'tool_use', 'tool_result', 'custom_tool_call']),
  id: z.string().optional(),
  role: z.string().optional(),
  status: z.string().optional(),
  content: z.union([z.array(OutputContentSchema), z.string()]).optional(),
  tool_use_id: z.string().optional(),
  name: z.string().optional(),
  input: z.unknown().optional(),
})

// Usage information
export const UsageSchema = z
  .object({
    input_tokens: z.number(),
    output_tokens: z.number(),
    total_tokens: z.number(),
    input_tokens_details: z
      .object({
        cached_tokens: z.number().optional(),
      })
      .optional(),
    output_tokens_details: z
      .object({
        reasoning_tokens: z.number().optional(),
      })
      .optional(),
    num_sources_used: z.number().optional(),
    num_server_side_tools_used: z.number().optional(),
    cost_in_usd_ticks: z.number().optional(),
  })
  .passthrough()

// Full API response from /v1/responses
export const GrokAgentResponseSchema = z
  .object({
    id: z.string(),
    object: z.literal('response'),
    created_at: z.number().optional(),
    completed_at: z.number().optional(),
    model: z.string(),
    output: z.array(OutputItemSchema).min(1),
    usage: UsageSchema.optional(),
    status: z.string().optional(),
    error: z.unknown().nullable().optional(),
  })
  .passthrough() // Allow additional fields like reasoning, tools, etc.

// Normalized response format (for backwards compatibility)
export const NormalizedChoiceSchema = z.object({
  index: z.number(),
  message: z.object({
    role: z.string(),
    content: z.string(),
  }),
  finish_reason: z.string(),
})

export const NormalizedUsageSchema = z.object({
  prompt_tokens: z.number(),
  completion_tokens: z.number(),
  total_tokens: z.number(),
})

export const GrokChatResponseSchema = z.object({
  id: z.string(),
  object: z.string(),
  created: z.number(),
  model: z.string(),
  choices: z.array(NormalizedChoiceSchema).min(1),
  usage: NormalizedUsageSchema.optional(),
  citations: z.array(z.string()).optional(),
})

// ============================================================================
// Error Schemas
// ============================================================================

export const GrokErrorResponseSchema = z
  .object({
    error: z
      .object({
        message: z.string().optional(),
        type: z.string().optional(),
        code: z.string().optional(),
      })
      .optional(),
    code: z.string().optional(),
  })
  .passthrough()

// ============================================================================
// Type Exports (inferred from schemas)
// ============================================================================

export type XSearchTool = z.infer<typeof XSearchToolSchema>
export type GrokRequestInput = z.infer<typeof GrokRequestInputSchema>
export type GrokAgentRequest = z.infer<typeof GrokAgentRequestSchema>
export type OutputContent = z.infer<typeof OutputContentSchema>
export type OutputItem = z.infer<typeof OutputItemSchema>
export type GrokAgentResponse = z.infer<typeof GrokAgentResponseSchema>
export type GrokChatResponse = z.infer<typeof GrokChatResponseSchema>
export type GrokErrorResponse = z.infer<typeof GrokErrorResponseSchema>

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate and parse a raw API response
 * Throws ZodError if validation fails
 */
export function parseAgentResponse(data: unknown): GrokAgentResponse {
  return GrokAgentResponseSchema.parse(data)
}

/**
 * Validate a normalized chat response
 * Throws ZodError if validation fails
 */
export function parseChatResponse(data: unknown): GrokChatResponse {
  return GrokChatResponseSchema.parse(data)
}

/**
 * Safe parse that returns success/error result instead of throwing
 */
export function safeParseAgentResponse(data: unknown) {
  return GrokAgentResponseSchema.safeParse(data)
}

export function safeParseChatResponse(data: unknown) {
  return GrokChatResponseSchema.safeParse(data)
}
