"use client";

import { useCallback } from "react";
import { useStream } from "@langchain/langgraph-sdk/react";
import {
  type Message,
  type Assistant,
  type Checkpoint,
} from "@langchain/langgraph-sdk";
import { v4 as uuidv4 } from "uuid";
import type { UseStreamThread } from "@langchain/langgraph-sdk/react";
import type { TodoItem } from "@/app/types/types";
import { useClient } from "@/providers/ClientProvider";
import { useQueryState } from "nuqs";
import { toast } from "sonner";
import {
  removeApprovalMode,
  removeModelChoice,
  type ApprovalMode,
  type ModelChoice,
} from "@/lib/config";

export type StateType = {
  messages: Message[];
  todos: TodoItem[];
  files: Record<string, string>;
  email?: {
    id?: string;
    subject?: string;
    page_content?: string;
  };
  ui?: any;
};

function isMissingThreadError(reason: unknown): boolean {
  const message = reason instanceof Error ? reason.message : String(reason);
  return /\b404\b|thread with id.*not found/i.test(message);
}

export function useChat({
  activeAssistant,
  activeAccountId,
  approvalMode,
  modelChoice,
  onHistoryRevalidate,
  onThreadCreated,
  thread,
}: {
  activeAssistant: Assistant | null;
  activeAccountId?: string;
  approvalMode: ApprovalMode;
  modelChoice: ModelChoice;
  onHistoryRevalidate?: () => void;
  onThreadCreated?: (threadId: string) => void;
  thread?: UseStreamThread<StateType>;
}) {
  const [threadId, setThreadId] = useQueryState("threadId");
  const client = useClient();

  const handleStreamError = useCallback(
    (reason: unknown) => {
      onHistoryRevalidate?.();
      if (!threadId || !isMissingThreadError(reason)) return;

      removeApprovalMode(threadId);
      removeModelChoice(threadId);
      void setThreadId(null);
      toast.info("Thread is no longer available", {
        description:
          "The old thread was cleared. You can start a new conversation.",
      });
    },
    [onHistoryRevalidate, setThreadId, threadId]
  );

  const stream = useStream<StateType>({
    assistantId: activeAssistant?.assistant_id || "",
    client: client ?? undefined,
    reconnectOnMount: true,
    threadId: threadId ?? null,
    onThreadId: (id) => {
      void setThreadId(id);
      onThreadCreated?.(id);
    },
    defaultHeaders: { "x-auth-scheme": "langsmith" },
    // Enable fetching state history when switching to existing threads
    fetchStateHistory: true,
    // Revalidate thread list when stream finishes, errors, or creates new thread
    onFinish: onHistoryRevalidate,
    onError: handleStreamError,
    onCreated: onHistoryRevalidate,
    experimental_thread: thread,
  });

  const runConfig = useCallback(
    () => ({
      ...(activeAssistant?.config ?? {}),
      recursion_limit: 100,
      configurable: {
        ...((activeAssistant?.config as any)?.configurable ?? {}),
        active_account_id: activeAccountId ?? "",
        approval_mode: approvalMode,
        model_provider: modelChoice,
      },
    }),
    [activeAssistant?.config, activeAccountId, approvalMode, modelChoice]
  );

  const sendMessage = useCallback(
    (content: string) => {
      const newMessage: Message = { id: uuidv4(), type: "human", content };
      stream.submit(
        { messages: [newMessage] },
        {
          optimisticValues: (prev) => ({
            messages: [...(prev.messages ?? []), newMessage],
          }),
          config: runConfig(),
        }
      );
      // Update thread list immediately when sending a message
      onHistoryRevalidate?.();
    },
    [stream, runConfig, onHistoryRevalidate]
  );

  const runSingleStep = useCallback(
    (
      messages: Message[],
      checkpoint?: Checkpoint,
      isRerunningSubagent?: boolean,
      optimisticMessages?: Message[]
    ) => {
      if (checkpoint) {
        stream.submit(undefined, {
          ...(optimisticMessages
            ? { optimisticValues: { messages: optimisticMessages } }
            : {}),
          config: runConfig(),
          checkpoint: checkpoint,
        });
      } else {
        stream.submit({ messages }, { config: runConfig() });
      }
    },
    [stream, runConfig]
  );

  const setFiles = useCallback(
    async (files: Record<string, string>) => {
      if (!threadId) return;
      // TODO: missing a way how to revalidate the internal state
      // I think we do want to have the ability to externally manage the state
      await client.threads.updateState(threadId, { values: { files } });
    },
    [client, threadId]
  );

  const continueStream = useCallback(
    (hasTaskToolCall?: boolean) => {
      stream.submit(undefined, {
        config: {
          ...runConfig(),
        },
      });
      // Update thread list when continuing stream
      onHistoryRevalidate?.();
    },
    [stream, runConfig, onHistoryRevalidate]
  );

  const markCurrentThreadAsResolved = useCallback(() => {
    stream.submit(null, { command: { goto: "__end__", update: null } });
    // Update thread list when marking thread as resolved
    onHistoryRevalidate?.();
  }, [stream, onHistoryRevalidate]);

  const resumeInterrupt = useCallback(
    (value: any) => {
      stream.submit(null, { config: runConfig(), command: { resume: value } });
      // Update thread list when resuming from interrupt
      onHistoryRevalidate?.();
    },
    [stream, runConfig, onHistoryRevalidate]
  );

  const stopStream = useCallback(() => {
    return stream
      .stop()
      .then(() => {
        onHistoryRevalidate?.();
        toast.info("Task stopped", {
          description: "The thread and its existing messages were kept.",
        });
      })
      .catch((reason: unknown) => {
        toast.error("Unable to stop task", {
          description:
            reason instanceof Error ? reason.message : String(reason),
        });
      });
  }, [onHistoryRevalidate, stream]);

  return {
    stream,
    activeAccountId,
    todos: stream.values.todos ?? [],
    files: stream.values.files ?? {},
    email: stream.values.email,
    ui: stream.values.ui,
    setFiles,
    messages: stream.messages,
    isLoading: stream.isLoading,
    isThreadLoading: stream.isThreadLoading,
    interrupt: stream.interrupt,
    getMessagesMetadata: stream.getMessagesMetadata,
    sendMessage,
    runSingleStep,
    continueStream,
    stopStream,
    markCurrentThreadAsResolved,
    resumeInterrupt,
  };
}
