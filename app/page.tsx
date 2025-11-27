"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useChat } from "@ai-sdk/react";
import { ArrowUp, Loader2, Plus, Square } from "lucide-react";
import { MessageWall } from "@/components/messages/message-wall";
import { ChatHeader } from "@/app/parts/chat-header";
import { ChatHeaderBlock } from "@/app/parts/chat-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UIMessage } from "ai";
import { useEffect, useState, useRef } from "react";
import { AI_NAME, CLEAR_CHAT_TEXT, OWNER_NAME, WELCOME_MESSAGE } from "@/config";
import Link from "next/link";

const formSchema = z.object({
  message: z
    .string()
    .min(1, "Message cannot be empty.")
    .max(2000, "Message must be at most 2000 characters."),
});

const STORAGE_KEY = "chat-messages";

const CAPABILITY_MESSAGE = `
I am built only for one thing: helping Indian students applying for Schengen visas.

I can help you with:

• Documents required
• Financial proofs
• Accommodation proofs
• Transport proofs
• Sponsorship
• Insurance
• Special category documents
• Minor (under 18) requirements
• Signatures and declarations
• Interview prep questions

I cannot answer anything outside these topics.
`.trim();

const OUT_OF_SCOPE_MESSAGE = `
Sorry, I'm not built for that.

I can only help Indian students with Schengen visa–related questions, such as documents required, financial proofs, accommodation, transport, sponsorship, insurance, special categories, minor requirements, signatures and interview preparation.
`.trim();

type StorageData = {
  messages: UIMessage[];
  durations: Record<string, number>;
};

const loadMessagesFromStorage = (): {
  messages: UIMessage[];
  durations: Record<string, number>;
} => {
  if (typeof window === "undefined") return { messages: [], durations: {} };
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return { messages: [], durations: {} };

    const parsed = JSON.parse(stored);
    return {
      messages: parsed.messages || [],
      durations: parsed.durations || {},
    };
  } catch (error) {
    console.error("Failed to load messages from localStorage:", error);
    return { messages: [], durations: {} };
  }
};

const saveMessagesToStorage = (
  messages: UIMessage[],
  durations: Record<string, number>
) => {
  if (typeof window === "undefined") return;
  try {
    const data: StorageData = { messages, durations };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error("Failed to save messages to localStorage:", error);
  }
};

// Simple keyword check to see if it's a Schengen visa–related query
function isSchengenVisaQuery(normalized: string): boolean {
  const keywords = [
    "schengen",
    "visa",
    "vfs",
    "embassy",
    "consulate",
    "appointment",
    "biometric",
    "passport",
    "travel",
    "itinerary",
    "flight",
    "ticket",
    "accommodation",
    "hotel",
    "hostel",
    "stay",
    "university",
    "college",
    "admission",
    "offer letter",
    "student visa",
    "type d",
    "short stay",
    "long stay",
    "national visa",
    "france",
    "germany",
    "italy",
    "spain",
    "netherlands",
    "estonia",
    "latvia",
    "lithuania",
    "belgium",
    "austria",
    "portugal",
    "documents",
    "document",
    "checklist",
    "sponsorship",
    "sponsor",
    "insurance",
    "medical",
    "pcc",
    "police clearance",
    "proof of funds",
    "bank statement",
    "blocked account"
  ];

  return keywords.some((k) => normalized.includes(k));
}

export default function Chat() {
  const [isClient, setIsClient] = useState(false);
  const [durations, setDurations] = useState<Record<string, number>>({});
  const welcomeMessageShownRef = useRef<boolean>(false);

  const stored =
    typeof window !== "undefined"
      ? loadMessagesFromStorage()
      : { messages: [], durations: {} };
  const [initialMessages] = useState<UIMessage[]>(stored.messages);

  const { messages, sendMessage, status, stop, setMessages } = useChat({
    messages: initialMessages,
  });

  useEffect(() => {
    setIsClient(true);
    setDurations(stored.durations);
    setMessages(stored.messages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isClient) {
      saveMessagesToStorage(messages, durations);
    }
  }, [durations, messages, isClient]);

  const handleDurationChange = (key: string, duration: number) => {
    setDurations((prevDurations) => {
      const newDurations = { ...prevDurations };
      newDurations[key] = duration;
      return newDurations;
    });
  };

  // Add welcome message once
  useEffect(() => {
    if (
      isClient &&
      initialMessages.length === 0 &&
      !welcomeMessageShownRef.current
    ) {
      const welcomeMessage: UIMessage = {
        id: `welcome-${Date.now()}`,
        role: "assistant",
        parts: [
          {
            type: "text",
            text: WELCOME_MESSAGE,
          },
        ],
      };
      setMessages([welcomeMessage]);
      saveMessagesToStorage([welcomeMessage], {});
      welcomeMessageShownRef.current = true;
    }
  }, [isClient, initialMessages.length, setMessages]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      message: "",
    },
  });

  function onSubmit(data: z.infer<typeof formSchema>) {
    const userText = data.message.trim();
    if (!userText) return;

    const normalized = userText
      .toLowerCase()
      .replace(/\?/g, "")
      .replace(/\s+/g, " ")
      .trim();

    // 1) Handle greetings
    const greetings = ["hi", "hello", "hey", "hii", "heyy", "helo"];
    const cleaned = normalized.replace(/[^a-z ]/g, "").trim();

    if (greetings.includes(cleaned)) {
      const userMsg: UIMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        parts: [{ type: "text", text: userText }],
      };

      const assistantMsg: UIMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        parts: [
          {
            type: "text",
            text: "Hi! I’m here to help Indian students with Schengen visas. Ask me about documents, proofs, or interview prep for your visa.",
          },
        ],
      };

      const newMessages = [...messages, userMsg, assistantMsg];
      setMessages(newMessages);
      saveMessagesToStorage(newMessages, durations);
      form.reset();
      return;
    }

    // 2) Handle "what can you do / what are you built for / who are you"
    const capabilityPhrases = [
      "what can you do",
      "what can you do for me",
      "what can u do",
      "what can u do for me",
      "who are you",
      "who r u",
      "what are you built for",
      "what are u built for",
      "what are you made for",
      "what are u made for",
    ];

    if (capabilityPhrases.includes(normalized)) {
      const userMsg: UIMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        parts: [{ type: "text", text: userText }],
      };

      const assistantMsg: UIMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        parts: [{ type: "text", text: CAPABILITY_MESSAGE }],
      };

      const newMessages = [...messages, userMsg, assistantMsg];
      setMessages(newMessages);
      saveMessagesToStorage(newMessages, durations);
      form.reset();
      return;
    }

    // 3) If not Schengen-visa related → refuse
    if (!isSchengenVisaQuery(normalized)) {
      const userMsg: UIMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        parts: [{ type: "text", text: userText }],
      };

      const assistantMsg: UIMessage = {
        id: `assistant-${Date.now() + 1}`,
        role: "assistant",
        parts: [{ type: "text", text: OUT_OF_SCOPE_MESSAGE }],
      };

      const newMessages = [...messages, userMsg, assistantMsg];
      setMessages(newMessages);
      saveMessagesToStorage(newMessages, durations);
      form.reset();
      return;
    }

    // 4) Valid Schengen visa question → send to backend
    sendMessage({ text: userText });
    form.reset();
  }

  function clearChat() {
    const newMessages: UIMessage[] = [];
    const newDurations = {};
    setMessages(newMessages);
    setDurations(newDurations);
    saveMessagesToStorage(newMessages, newDurations);
    toast.success("Chat cleared");
  }

  return (
    <div className="relative flex h-screen items-center justify-center font-sans">
      {/* background image with light monuments theme */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-fixed opacity-25"
        style={{ backgroundImage: "url('/bg-europe.png')" }}
      />
      {/* soft white/blue overlay for readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-sky-50/90 via-slate-50/95 to-blue-50/98 dark:from-slate-950/95 dark:via-slate-950/98 dark:to-black/95" />

      <main className="relative z-10 w-full h-screen">
        {/* HEADER */}
        <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-sky-900/90 via-sky-900/75 to-transparent dark:from-sky-950 dark:via-slate-950/95 dark:to-transparent pb-16 text-slate-50">
          <div className="relative">
            <ChatHeader>
              <ChatHeaderBlock />

              <ChatHeaderBlock className="justify-center items-center gap-3">
                <Avatar className="size-9 ring-2 ring-yellow-300 shadow-sm bg-sky-900">
                  <AvatarImage src="/eu-flag.png" />
                  <AvatarFallback className="bg-sky-900 text-yellow-300 text-xs font-semibold">
                    EU
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <p className="text-sm font-semibold tracking-tight">
                    {AI_NAME || "Schengen Visa Assistant"}
                  </p>
                  <p className="text-[11px] text-slate-200">
                    Built for Indian students applying for Schengen visas –
                    documents, proofs, checklists & interview prep only.
                  </p>
                </div>
              </ChatHeaderBlock>

              <ChatHeaderBlock className="justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  className="cursor-pointer rounded-full border-sky-200 bg-sky-900/40 hover:bg-sky-800 text-xs text-slate-50"
                  onClick={clearChat}
                >
                  <Plus className="size-3 mr-1" />
                  {CLEAR_CHAT_TEXT}
                </Button>
              </ChatHeaderBlock>
            </ChatHeader>
          </div>
        </div>

        {/* MESSAGES */}
        <div className="h-screen overflow-y-auto px-5 py-4 w-full pt-[92px] pb-[150px]">
          <div className="flex flex-col items-center justify-end min-h-full">
            {isClient ? (
              <>
                <MessageWall
                  messages={messages}
                  status={status}
                  durations={durations}
                  onDurationChange={handleDurationChange}
                />
                {status === "submitted" && (
                  <div className="flex justify-start max-w-3xl w-full mt-2">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  </div>
                )}
              </>
            ) : (
              <div className="flex justify-center max-w-2xl w-full">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        </div>

        {/* INPUT + FOOTER */}
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-slate-200/95 via-slate-100/90 to-transparent dark:from-black dark:via-slate-950 dark:to-transparent pt-13">
          <div className="w-full px-5 pt-5 pb-1 flex justify-center">
            <div className="max-w-3xl w-full">
              <form id="chat-form" onSubmit={form.handleSubmit(onSubmit)}>
                <FieldGroup>
                  <Controller
                    name="message"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel
                          htmlFor="chat-form-message"
                          className="sr-only"
                        >
                          Message
                        </FieldLabel>
                        <div className="relative h-13">
                          <Input
                            {...field}
                            id="chat-form-message"
                            className="h-15 pr-14 pl-5 bg-white/90 dark:bg-card rounded-2xl border border-sky-300 focus-visible:ring-sky-500 text-sm"
                            placeholder='Try: "What can you do for me" or "What documents do I need for a France student visa?"'
                            disabled={status === "streaming"}
                            aria-invalid={fieldState.invalid}
                            autoComplete="off"
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                form.handleSubmit(onSubmit)();
                              }
                            }}
                          />
                          {(status === "ready" || status === "error") && (
                            <Button
                              className="absolute right-2 top-2 rounded-full h-10 w-10 shadow-sm bg-sky-700 hover:bg-sky-800"
                              type="submit"
                              disabled={!field.value.trim()}
                              size="icon"
                            >
                              <ArrowUp className="size-4" />
                            </Button>
                          )}
                          {(status === "streaming" ||
                            status === "submitted") && (
                            <Button
                              className="absolute right-2 top-2 rounded-full h-10 w-10 bg-slate-900 hover:bg-slate-800"
                              size="icon"
                              type="button"
                              onClick={() => {
                                stop();
                              }}
                            >
                              <Square className="size-4" />
                            </Button>
                          )}
                        </div>
                      </Field>
                    )}
                  />
                </FieldGroup>
              </form>
            </div>
          </div>

          <div className="w-full px-5 py-3 flex justify-center text-[11px] text-muted-foreground">
            © {new Date().getFullYear()} {OWNER_NAME}&nbsp;
            <Link href="/terms" className="underline">
              Terms of Use
            </Link>
            &nbsp;· Schengen visa information assistant (not legal advice) ·
            Powered by&nbsp;
            <Link href="https://ringel.ai/" className="underline">
              Ringel.AI
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
