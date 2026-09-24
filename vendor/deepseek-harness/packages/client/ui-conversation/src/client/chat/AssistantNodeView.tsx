import { memo, useLayoutEffect, useMemo } from 'react'
import type { ChatNodeViewProps, TurnTailOwnerProps } from '../contract/slots.ts'
import { AssistantMarkdown } from './AssistantMarkdown.tsx'

/** Streaming, settled, and interrupted Assistant states share one keyed renderer instance. */
export const AssistantNodeView = memo(function AssistantNodeView({
  node, sessionId, useTurnData, openFile, renderMessageImages, fileMentions, t,
}: ChatNodeViewProps<'assistant-step'>) {
  const data = node.data
  useLayoutEffect(() => {
    if ((globalThis as typeof globalThis & { __DSH_OUTPUT_TRACE__?: boolean }).__DSH_OUTPUT_TRACE__ !== true) return
    const visibleChars = data.blocks.reduce((count, block) => count
      + (block.kind === 'text' || block.kind === 'reasoning' ? block.text.length : 0), 0)
    console.debug('[dsh-output-trace]', {
      timestamp: new Date().toISOString(),
      stage: data.status === 'running' ? 'chunk-rendered' : 'output-rendered',
      sessionId,
      seq: data.finalNode?.seq ?? data.lastChunkSeq ?? node.anchorSeq,
      visibleChars,
    })
  }, [data.blocks, data.finalNode, data.lastChunkSeq, data.status, node.anchorSeq, sessionId])
  const turn = node.location.kind === 'turn' || node.location.kind === 'step'
    ? node.location.turn
    : undefined
  const tail = useTurnData('turn-tail')
  const owner = useMemo<TurnTailOwnerProps | undefined>(() => {
    if (turn?.status !== 'closed' || data.finalNode === undefined) return undefined
    if (tail?.closing?.finalNode.seq !== data.finalNode.seq) return undefined
    return { turn, seq: data.finalNode.seq, openFile }
  }, [data.finalNode, openFile, tail, turn])
  const mentions = useMemo(
    () => owner === undefined ? undefined : fileMentions(owner),
    [fileMentions, owner],
  )
  return (
    <AssistantMarkdown
      blocks={data.blocks}
      streaming={data.status === 'running'}
      interrupted={data.status === 'interrupted'}
      renderMessageImages={renderMessageImages}
      mentions={mentions}
      t={t}
    />
  )
})
