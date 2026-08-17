"use client";

import React, {
  useState,
  useRef,
  useCallback,
  useMemo,
  useEffect,
  FormEvent,
  Fragment,
} from "react";
import { Button } from "@/components/ui/button";
import {
  Square,
  ArrowUp,
  CheckCircle,
  Clock,
  Circle,
  FileIcon,
} from "lucide-react";
import { ChatMessage } from "@/app/components/ChatMessage";
import { ToolApprovalInterrupt } from "@/app/components/ToolApprovalInterrupt";
import type {
  TodoItem,
  ToolCall,
  ActionRequest,
  ReviewConfig,
  ApprovalRequestEntry,
  ApprovalDecision,
} from "@/app/types/types";
import type { ApprovalMode, ModelChoice } from "@/lib/config";
import { Assistant, Message } from "@langchain/langgraph-sdk";
import { extractStringFromMessageContent } from "@/app/utils/utils";
import { useChatContext } from "@/providers/ChatProvider";
import { cn } from "@/lib/utils";
import { useStickToBottom } from "use-stick-to-bottom";
import { FilesPopover } from "@/app/components/TasksFilesSidebar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ChatInterfaceProps {
  assistant: Assistant | null;
  approvalMode: ApprovalMode;
  onApprovalModeChange: (mode: ApprovalMode) => void;
  modelChoice: ModelChoice;
  onModelChoiceChange: (choice: ModelChoice) => void;
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function normalizeApprovalRequests(interrupt: unknown): ApprovalRequestEntry[] {
  if (!interrupt) return [];

  const interruptValues = asArray(interrupt).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const value = (item as { value?: unknown }).value;
    return asArray(value);
  });

  const payloads = interruptValues.filter(
    (value): value is Record<string, unknown> =>
      Boolean(value) && typeof value === "object" && !Array.isArray(value)
  );
  const actionRequests = payloads.flatMap((payload) =>
    asArray(
      payload.action_requests as ActionRequest | ActionRequest[] | undefined
    )
  );
  const reviewConfigs = payloads.flatMap((payload) =>
    asArray(payload.review_configs as ReviewConfig[] | undefined)
  );
  const usedReviewConfigs = new Set<number>();

  return actionRequests.map((actionRequest, index) => {
    const actionName = actionRequest.name;
    const reviewConfigIndex = reviewConfigs.findIndex((config, configIndex) => {
      if (usedReviewConfigs.has(configIndex)) return false;
      const rawConfig = config as ReviewConfig & { action_name?: string };
      return (rawConfig.actionName || rawConfig.action_name) === actionName;
    });
    const fallbackReviewConfig = reviewConfigs.findIndex(
      (_, configIndex) => !usedReviewConfigs.has(configIndex)
    );
    const selectedReviewConfigIndex =
      reviewConfigIndex >= 0 ? reviewConfigIndex : fallbackReviewConfig;

    if (selectedReviewConfigIndex >= 0) {
      usedReviewConfigs.add(selectedReviewConfigIndex);
    }

    const rawReviewConfig =
      selectedReviewConfigIndex >= 0
        ? (reviewConfigs[selectedReviewConfigIndex] as ReviewConfig & {
            action_name?: string;
            allowed_decisions?: string[];
          })
        : undefined;

    return {
      key: `${actionName}:${index}`,
      actionRequest,
      reviewConfig: rawReviewConfig
        ? {
            ...rawReviewConfig,
            actionName:
              rawReviewConfig.actionName ||
              rawReviewConfig.action_name ||
              actionName,
            allowedDecisions:
              rawReviewConfig.allowedDecisions ||
              rawReviewConfig.allowed_decisions,
          }
        : undefined,
    };
  });
}

const getStatusIcon = (status: TodoItem["status"], className?: string) => {
  switch (status) {
    case "completed":
      return (
        <CheckCircle
          size={16}
          className={cn("text-success/80", className)}
        />
      );
    case "in_progress":
      return (
        <Clock
          size={16}
          className={cn("text-warning/80", className)}
        />
      );
    default:
      return (
        <Circle
          size={16}
          className={cn("text-tertiary/70", className)}
        />
      );
  }
};

export const ChatInterface = React.memo<ChatInterfaceProps>(
  ({
    assistant,
    approvalMode,
    onApprovalModeChange,
    modelChoice,
    onModelChoiceChange,
  }) => {
    const [metaOpen, setMetaOpen] = useState<"tasks" | "files" | null>(null);
    const tasksContainerRef = useRef<HTMLDivElement | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);

    const [input, setInput] = useState("");
    const { scrollRef, contentRef } = useStickToBottom();

    const {
      stream,
      activeAccountId,
      messages,
      todos,
      files,
      ui,
      setFiles,
      isLoading,
      isThreadLoading,
      interrupt,
      sendMessage,
      stopStream,
      resumeInterrupt,
    } = useChatContext();

    const approvalRequests = useMemo(
      () => normalizeApprovalRequests(interrupt),
      [interrupt]
    );
    const [approvalDecisions, setApprovalDecisions] = useState<
      ApprovalDecision[]
    >([]);
    const approvalResumeStartedRef = useRef(false);
    const approvalStepRef = useRef(0);
    const approvalSessionKey = useMemo(
      () =>
        `${messages.at(-1)?.id ?? ""}:${
          (interrupt as { id?: string } | undefined)?.id ?? ""
        }:${approvalRequests.map((request) => request.key).join("|")}`,
      [approvalRequests, interrupt, messages]
    );

    useEffect(() => {
      setApprovalDecisions([]);
      approvalResumeStartedRef.current = false;
      approvalStepRef.current = 0;
    }, [approvalSessionKey]);

    const currentApprovalIndex = approvalDecisions.length;
    const currentApprovalRequest = approvalRequests[currentApprovalIndex];

    const handleApprovalDecision = useCallback(
      (decision: ApprovalDecision) => {
        if (
          !currentApprovalRequest ||
          approvalResumeStartedRef.current ||
          approvalStepRef.current !== approvalDecisions.length
        ) {
          return;
        }

        const nextDecisions = [...approvalDecisions, decision];
        approvalStepRef.current = nextDecisions.length;

        if (nextDecisions.length === approvalRequests.length) {
          approvalResumeStartedRef.current = true;
          resumeInterrupt({ decisions: nextDecisions });
          return;
        }

        setApprovalDecisions(nextDecisions);
      },
      [
        approvalDecisions,
        approvalRequests.length,
        currentApprovalRequest,
        resumeInterrupt,
      ]
    );

    const submitDisabled =
      isLoading ||
      !assistant ||
      !activeAccountId ||
      approvalRequests.length > 0;

    const handleSubmit = useCallback(
      (e?: FormEvent) => {
        if (e) {
          e.preventDefault();
        }
        const messageText = input.trim();
        if (!messageText || isLoading || submitDisabled) return;
        sendMessage(messageText);
        setInput("");
      },
      [input, isLoading, sendMessage, setInput, submitDisabled]
    );

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (submitDisabled) return;
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          handleSubmit();
        }
      },
      [handleSubmit, submitDisabled]
    );

    // TODO: can we make this part of the hook?
    const processedMessages = useMemo(() => {
      /*
     1. Loop through all messages
     2. For each AI message, add the AI message, and any tool calls to the messageMap
     3. For each tool message, find the corresponding tool call in the messageMap and update the status and output
    */
      const messageMap = new Map<
        string,
        { message: Message; toolCalls: ToolCall[] }
      >();
      messages.forEach((message: Message) => {
        if (message.type === "ai") {
          const toolCallsInMessage: Array<{
            id?: string;
            function?: { name?: string; arguments?: unknown };
            name?: string;
            type?: string;
            args?: unknown;
            input?: unknown;
          }> = [];
          if (
            message.additional_kwargs?.tool_calls &&
            Array.isArray(message.additional_kwargs.tool_calls)
          ) {
            toolCallsInMessage.push(...message.additional_kwargs.tool_calls);
          } else if (message.tool_calls && Array.isArray(message.tool_calls)) {
            toolCallsInMessage.push(
              ...message.tool_calls.filter(
                (toolCall: { name?: string }) => toolCall.name !== ""
              )
            );
          } else if (Array.isArray(message.content)) {
            const toolUseBlocks = message.content.filter(
              (block: { type?: string }) => block.type === "tool_use"
            );
            toolCallsInMessage.push(...toolUseBlocks);
          }
          const toolCallsWithStatus = toolCallsInMessage.map(
            (toolCall: {
              id?: string;
              function?: { name?: string; arguments?: unknown };
              name?: string;
              type?: string;
              args?: unknown;
              input?: unknown;
            }) => {
              const name =
                toolCall.function?.name ||
                toolCall.name ||
                toolCall.type ||
                "unknown";
              const args =
                toolCall.function?.arguments ||
                toolCall.args ||
                toolCall.input ||
                {};
              return {
                id: toolCall.id || `tool-${Math.random()}`,
                name,
                args,
                status: interrupt ? "interrupted" : ("pending" as const),
              } as ToolCall;
            }
          );
          messageMap.set(message.id!, {
            message,
            toolCalls: toolCallsWithStatus,
          });
        } else if (message.type === "tool") {
          const toolCallId = message.tool_call_id;
          if (!toolCallId) {
            return;
          }
          for (const [, data] of messageMap.entries()) {
            const toolCallIndex = data.toolCalls.findIndex(
              (tc: ToolCall) => tc.id === toolCallId
            );
            if (toolCallIndex === -1) {
              continue;
            }
            data.toolCalls[toolCallIndex] = {
              ...data.toolCalls[toolCallIndex],
              status: "completed" as const,
              result: extractStringFromMessageContent(message),
            };
            break;
          }
        } else if (message.type === "human") {
          messageMap.set(message.id!, {
            message,
            toolCalls: [],
          });
        }
      });
      const processedArray = Array.from(messageMap.values());
      return processedArray.map((data, index) => {
        const prevMessage =
          index > 0 ? processedArray[index - 1].message : null;
        return {
          ...data,
          showAvatar: data.message.type !== prevMessage?.type,
        };
      });
    }, [messages, interrupt]);

    const groupedTodos = {
      in_progress: todos.filter((t) => t.status === "in_progress"),
      pending: todos.filter((t) => t.status === "pending"),
      completed: todos.filter((t) => t.status === "completed"),
    };

    const hasTasks = todos.length > 0;
    const hasFiles = Object.keys(files).length > 0;

    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <div
          className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain"
          ref={scrollRef}
        >
          <div
            className="mx-auto w-full max-w-[1024px] px-6 pb-6 pt-4"
            ref={contentRef}
          >
            {isThreadLoading ? (
              <div className="flex items-center justify-center p-8">
                <p className="text-muted-foreground">Loading...</p>
              </div>
            ) : (
              <>
                {processedMessages.map((data) => {
                  const messageUi = ui?.filter(
                    (u: any) => u.metadata?.message_id === data.message.id
                  );
                  return (
                    <ChatMessage
                      key={data.message.id}
                      message={data.message}
                      toolCalls={data.toolCalls}
                      ui={messageUi}
                      stream={stream}
                      graphId={assistant?.graph_id}
                    />
                  );
                })}
                {currentApprovalRequest && (
                  <div className="mt-4">
                    <p
                      className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                      aria-live="polite"
                    >
                      Action {currentApprovalIndex + 1} of{" "}
                      {approvalRequests.length}
                    </p>
                    <ToolApprovalInterrupt
                      key={currentApprovalRequest.key}
                      actionRequest={currentApprovalRequest.actionRequest}
                      reviewConfig={currentApprovalRequest.reviewConfig}
                      onDecision={handleApprovalDecision}
                      isLoading={isLoading || approvalResumeStartedRef.current}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="flex-shrink-0 bg-background">
          <div
            className={cn(
              "mx-4 mb-6 flex flex-shrink-0 flex-col overflow-hidden rounded-[28px] border border-border bg-background shadow-lg shadow-black/10",
              "mx-auto w-[calc(100%-32px)] max-w-[1024px] transition-colors duration-200 ease-in-out"
            )}
          >
            {(hasTasks || hasFiles) && (
              <div className="flex max-h-72 flex-col overflow-y-auto border-b border-border bg-sidebar empty:hidden">
                {!metaOpen && (
                  <>
                    {(() => {
                      const activeTask = todos.find(
                        (t) => t.status === "in_progress"
                      );

                      const totalTasks = todos.length;
                      const remainingTasks =
                        totalTasks - groupedTodos.pending.length;
                      const isCompleted = totalTasks === remainingTasks;

                      const tasksTrigger = (() => {
                        if (!hasTasks) return null;
                        return (
                          <button
                            type="button"
                            onClick={() =>
                              setMetaOpen((prev) =>
                                prev === "tasks" ? null : "tasks"
                              )
                            }
                            className="grid w-full cursor-pointer grid-cols-[auto_auto_1fr] items-center gap-3 px-[18px] py-3 text-left"
                            aria-expanded={metaOpen === "tasks"}
                          >
                            {(() => {
                              if (isCompleted) {
                                return [
                                  <CheckCircle
                                    key="icon"
                                    size={16}
                                    className="text-success/80"
                                  />,
                                  <span
                                    key="label"
                                    className="ml-[1px] min-w-0 truncate text-sm"
                                  >
                                    All tasks completed
                                  </span>,
                                ];
                              }

                              if (activeTask != null) {
                                return [
                                  <div key="icon">
                                    {getStatusIcon(activeTask.status)}
                                  </div>,
                                  <span
                                    key="label"
                                    className="ml-[1px] min-w-0 truncate text-sm"
                                  >
                                    Task{" "}
                                    {totalTasks - groupedTodos.pending.length}{" "}
                                    of {totalTasks}
                                  </span>,
                                  <span
                                    key="content"
                                    className="min-w-0 gap-2 truncate text-sm text-muted-foreground"
                                  >
                                    {activeTask.content}
                                  </span>,
                                ];
                              }

                              return [
                                <Circle
                                  key="icon"
                                  size={16}
                                  className="text-tertiary/70"
                                />,
                                <span
                                  key="label"
                                  className="ml-[1px] min-w-0 truncate text-sm"
                                >
                                  Task{" "}
                                  {totalTasks - groupedTodos.pending.length} of{" "}
                                  {totalTasks}
                                </span>,
                              ];
                            })()}
                          </button>
                        );
                      })();

                      const filesTrigger = (() => {
                        if (!hasFiles) return null;
                        return (
                          <button
                            type="button"
                            onClick={() =>
                              setMetaOpen((prev) =>
                                prev === "files" ? null : "files"
                              )
                            }
                            className="flex flex-shrink-0 cursor-pointer items-center gap-2 px-[18px] py-3 text-left text-sm"
                            aria-expanded={metaOpen === "files"}
                          >
                            <FileIcon size={16} />
                            Files (State)
                            <span className="h-4 min-w-4 rounded-full bg-[#2F6868] px-0.5 text-center text-[10px] leading-[16px] text-white">
                              {Object.keys(files).length}
                            </span>
                          </button>
                        );
                      })();

                      return (
                        <div className="grid grid-cols-[1fr_auto_auto] items-center">
                          {tasksTrigger}
                          {filesTrigger}
                        </div>
                      );
                    })()}
                  </>
                )}

                {metaOpen && (
                  <>
                    <div className="sticky top-0 flex items-stretch bg-sidebar text-sm">
                      {hasTasks && (
                        <button
                          type="button"
                          className="py-3 pr-4 first:pl-[18px] aria-expanded:font-semibold"
                          onClick={() =>
                            setMetaOpen((prev) =>
                              prev === "tasks" ? null : "tasks"
                            )
                          }
                          aria-expanded={metaOpen === "tasks"}
                        >
                          Tasks
                        </button>
                      )}
                      {hasFiles && (
                        <button
                          type="button"
                          className="inline-flex items-center gap-2 py-3 pr-4 first:pl-[18px] aria-expanded:font-semibold"
                          onClick={() =>
                            setMetaOpen((prev) =>
                              prev === "files" ? null : "files"
                            )
                          }
                          aria-expanded={metaOpen === "files"}
                        >
                          Files (State)
                          <span className="h-4 min-w-4 rounded-full bg-[#2F6868] px-0.5 text-center text-[10px] leading-[16px] text-white">
                            {Object.keys(files).length}
                          </span>
                        </button>
                      )}
                      <button
                        aria-label="Close"
                        className="flex-1"
                        onClick={() => setMetaOpen(null)}
                      />
                    </div>
                    <div
                      ref={tasksContainerRef}
                      className="px-[18px]"
                    >
                      {metaOpen === "tasks" &&
                        Object.entries(groupedTodos)
                          .filter(([_, todos]) => todos.length > 0)
                          .map(([status, todos]) => (
                            <div
                              key={status}
                              className="mb-4"
                            >
                              <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-tertiary">
                                {
                                  {
                                    pending: "Pending",
                                    in_progress: "In Progress",
                                    completed: "Completed",
                                  }[status]
                                }
                              </h3>
                              <div className="grid grid-cols-[auto_1fr] gap-3 rounded-sm p-1 pl-0 text-sm">
                                {todos.map((todo, index) => (
                                  <Fragment
                                    key={`${status}_${todo.id}_${index}`}
                                  >
                                    {getStatusIcon(todo.status, "mt-0.5")}
                                    <span className="break-words text-inherit">
                                      {todo.content}
                                    </span>
                                  </Fragment>
                                ))}
                              </div>
                            </div>
                          ))}

                      {metaOpen === "files" && (
                        <div className="mb-6">
                          <FilesPopover
                            files={files}
                            setFiles={setFiles}
                            editDisabled={
                              isLoading === true || interrupt !== undefined
                            }
                          />
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
            <form
              onSubmit={handleSubmit}
              className="flex min-h-[150px] flex-col"
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  isLoading
                    ? "Running..."
                    : activeAccountId
                    ? "Ask the agent..."
                    : "Add and select an email account first"
                }
                className="font-inherit field-sizing-content min-h-[92px] flex-1 resize-none border-0 bg-transparent px-5 pb-3 pt-5 text-[15px] leading-7 text-primary outline-none placeholder:text-tertiary"
                rows={3}
              />
              <div className="flex items-center justify-between gap-2 p-3">
                <Select
                  value={approvalMode}
                  onValueChange={(value) =>
                    onApprovalModeChange(value as ApprovalMode)
                  }
                >
                  <SelectTrigger
                    className="h-10 w-[170px] rounded-full border-border/70 bg-background/30"
                    aria-label="Agent action approval mode"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="start">
                    <SelectItem value="ask">Ask for approval</SelectItem>
                    <SelectItem value="smart">Approve for me</SelectItem>
                    <SelectItem value="full">Full access</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex items-center justify-end gap-2">
                  <Select
                    value={modelChoice}
                    onValueChange={(value) =>
                      onModelChoiceChange(value as ModelChoice)
                    }
                  >
                    <SelectTrigger
                      className="h-10 w-[170px] rounded-full border-border/70 bg-background/30"
                      aria-label="Model"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent align="end">
                      <SelectItem value="deepseek">DeepSeek</SelectItem>
                      <SelectItem value="local">Local model · Qwen</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type={isLoading ? "button" : "submit"}
                    variant={isLoading ? "destructive" : "default"}
                    onClick={isLoading ? stopStream : handleSubmit}
                    disabled={!isLoading && (submitDisabled || !input.trim())}
                    className="h-11 w-11 rounded-full p-0"
                    aria-label={isLoading ? "Stop" : "Send"}
                  >
                    {isLoading ? <Square size={15} /> : <ArrowUp size={19} />}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }
);

ChatInterface.displayName = "ChatInterface";
