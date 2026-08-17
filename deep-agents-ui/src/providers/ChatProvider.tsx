"use client";

import { ReactNode, createContext, useContext } from "react";
import { Assistant } from "@langchain/langgraph-sdk";
import { type StateType, useChat } from "@/app/hooks/useChat";
import type { UseStreamThread } from "@langchain/langgraph-sdk/react";
import type { ApprovalMode, ModelChoice } from "@/lib/config";

interface ChatProviderProps {
  children: ReactNode;
  activeAssistant: Assistant | null;
  activeAccountId?: string;
  approvalMode: ApprovalMode;
  modelChoice: ModelChoice;
  onHistoryRevalidate?: () => void;
  onThreadCreated?: (threadId: string) => void;
  thread?: UseStreamThread<StateType>;
}

export function ChatProvider({
  children,
  activeAssistant,
  activeAccountId,
  approvalMode,
  modelChoice,
  onHistoryRevalidate,
  onThreadCreated,
  thread,
}: ChatProviderProps) {
  const chat = useChat({
    activeAssistant,
    activeAccountId,
    approvalMode,
    modelChoice,
    onHistoryRevalidate,
    onThreadCreated,
    thread,
  });
  return <ChatContext.Provider value={chat}>{children}</ChatContext.Provider>;
}

export type ChatContextType = ReturnType<typeof useChat>;

export const ChatContext = createContext<ChatContextType | undefined>(
  undefined
);

export function useChatContext() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error("useChatContext must be used within a ChatProvider");
  }
  return context;
}
