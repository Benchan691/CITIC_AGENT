import { z } from 'zod'
import type { FolderView } from './folders.ts'
import type { Wire } from './rpc.schema.ts'
import type { ResponseValue } from './rpc-map.ts'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { folderIdSchema, sessionSummarySchema } from './sessions.schema.ts'

export const folderViewSchema: z.ZodType<Wire<FolderView>> = z.object({
  folderId: folderIdSchema,
  name: z.string(),
  description: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  sessionIds: z.array(z.string()) as unknown as z.ZodType<SessionId[]>,
})

export const folderListRequestSchema = z.object({})
export const folderGetRequestSchema = z.object({ folderId: folderIdSchema })
export const folderCreateRequestSchema = z.object({ name: z.string(), description: z.string().optional() })
export const folderRenameRequestSchema = z.object({ folderId: folderIdSchema, name: z.string(), description: z.string().optional() })
export const folderDeleteRequestSchema = z.object({ folderId: folderIdSchema })
export const folderMoveSessionRequestSchema = z.object({
  folderId: folderIdSchema,
  sessionId: z.string() as unknown as z.ZodType<SessionId>,
})
export const folderListSessionsRequestSchema = z.object({ folderId: folderIdSchema })

// The fetch client validates `full.result.value` here. These are value
// schemas, not full RpcResult schemas; wrapping them in rpcResultSchema makes
// every successful folder response fail with invalid_union because the `ok`
// field was already unwrapped by the carrier.
export const folderListValueSchema: z.ZodType<Wire<ResponseValue<'folder.list'>>> = z.object({ items: z.array(folderViewSchema) })
export const folderGetValueSchema: z.ZodType<Wire<ResponseValue<'folder.get'>>> = z.object({ folder: folderViewSchema })
export const folderCreateValueSchema: z.ZodType<Wire<ResponseValue<'folder.create'>>> = z.object({ folder: folderViewSchema })
export const folderRenameValueSchema: z.ZodType<Wire<ResponseValue<'folder.rename'>>> = z.object({ folder: folderViewSchema })
export const folderDeleteValueSchema: z.ZodType<Wire<ResponseValue<'folder.delete'>>> = z.object({ deleted: z.literal(true), deletedSessionCount: z.number().int().nonnegative() })
export const folderMoveSessionValueSchema: z.ZodType<Wire<ResponseValue<'folder.moveSessionToFolder'>>> = z.object({ folder: folderViewSchema })
export const folderListSessionsValueSchema: z.ZodType<Wire<ResponseValue<'folder.listSessionsByFolder'>>> = z.object({ items: z.array(sessionSummarySchema) })
