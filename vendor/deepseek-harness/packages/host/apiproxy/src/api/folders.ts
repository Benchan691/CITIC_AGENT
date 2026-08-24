import type { Branded } from '@deepseek-ai/dsh-brand'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { SessionSummary } from './sessions.ts'
import type { RpcRequest, RpcResponse } from './rpc.ts'

export type FolderId = Branded<'FolderId'>

export interface FolderView {
  folderId: FolderId
  name: string
  description?: string
  createdAt: string
  updatedAt: string
  sessionIds: SessionId[]
}

export interface FoldersApi {
  list(request: RpcRequest<{}>): Promise<RpcResponse<{ items: FolderView[] }>>
  get(request: RpcRequest<{ folderId: FolderId }>): Promise<RpcResponse<{ folder: FolderView }>>
  create(request: RpcRequest<{ name: string; description?: string }>): Promise<RpcResponse<{ folder: FolderView }>>
  rename(request: RpcRequest<{ folderId: FolderId; name: string; description?: string }>): Promise<RpcResponse<{ folder: FolderView }>>
  delete(request: RpcRequest<{ folderId: FolderId }>): Promise<RpcResponse<{ deleted: true; deletedSessionCount: number }>>
  moveSessionToFolder(request: RpcRequest<{ sessionId: SessionId; folderId: FolderId }>): Promise<RpcResponse<{ folder: FolderView }>>
  listSessionsByFolder(request: RpcRequest<{ folderId: FolderId }>): Promise<RpcResponse<{ items: SessionSummary[] }>>
}
