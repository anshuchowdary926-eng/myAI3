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
import { ChatHeader, ChatHeaderBlock } from "@/app/parts/chat-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UIMessage } from "ai";
import { useEffect, useState, useRef } from "react";
import { AI_NAME, CLEAR_CHAT_TEXT, OWNER_NAME, WELCOME_MESSAGE } from "@/config";
import Link from "next/link";

// -----------------------------
// SCHEMA
// -----------------------------
const formSchema = z.object({
  message: z
    .string()
    .min(1, "Message cannot be empty.")
    .max(2000, "Message must be at most 2000 characters."),
});

// -----------------------------
// LOCAL STORAGE
// -----------------------------
const STORAGE_KEY = "chat-messages";

type StorageData = {
  messages: UIMessage[];
  durations: Record<string, number>;
};

const loadMessagesFromStorage = () => {
  if (typeof window === "undefined") return { messages: [], durations: {} };
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return { messages: [], durations: {} };
    return JSON.parse(stored);
  } catch {
    return { messages: [], durations: {} };
  }
};

const saveMessagesToStorage = (
  messages: UIMessage[],
  durations: Record<string, number>
) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ messages, durations }));
};

// -----------------------------
// SCHENGEN COUNTRIES LIST
// -----------------------------
const SCHENGEN_COUNTRIES = [
  "france",
  "germany",
  "sweden",
  "netherlands",
  "italy",
  "spain",
  "portugal",
  "finland",
  "belgium",
  "czech",
  "czech republic",
  "austria",
  "switzerland",
  "norway",
  "denmark",
  "estonia",
  "latvia",
  "lithuania",
  "slovakia",
  "slovenia",
  "hungary",
  "poland",
  "malta",
  "luxembourg",
  "iceland",
  "liechtenstein",
  "greece",
];

function isSchengenQuery(msg: string) {
  const m = msg.toLowerCase();

  // detect country by name
  if (SCHENGEN_COUNTRIES.some((c) => m.includes(c))) return true;

  // detect visa hints
  if (
    m.includes("visa") ||
    m.includes("vfs") ||
    m.includes("appointment") ||
    m.includes("embassy") ||
    m.includes("consulate") ||
    m.includes("short stay") ||
    m.includes("schengen")
  )
    return true;

  return false;
}

// Capability list
const CAPABILITY_RESPONSE = `Here’s what I can help you with as a Schengen Visa Assistant:

• Documents required  
• Financial proofs  
• Accommodation proofs  
• Transport proofs  
• Sponsorship  
• Insurance  
• Special-category documents  
• Minor (under 18) requirements  
• Signatures & declarations  
• Interview preparation  

Ask me anything related to a **Schengen visa**, including country-specific guidance for France, Germany, Italy, Spain, Netherlands, Finland, Belgium, Czech Republic, Austria, Switzerland, Norway, Denmark, Estonia, Latvia, Lithuania, Slovakia, Slovenia, Hungary, Poland, Malta, Luxembourg, Iceland and Liechtenstein.`;

// -----------------------------
// MAIN CHAT COMPONENT
// -----------------------------
export default function Chat() {
  const [isClient, setIsClient] = useState(false);
  const [durations, setDurations] = useState<Record<string, number>>({});
  const welcomeMessageShownRef = useRef(false);

  const stored =
    typeof window !== "undefined"
      ? loadMessagesFromStorage()
      : { messages: [], durations: {} };
  const [initialMessages] = useState<UIMessage[]>(stored.messages);

  const { messages, sendMessage, status, stop, setMessages } = useChat({
    messages: initialMessages,
    async onSend(message) {
      const m = message.text.toLowerCase();

      // 1. Greet normally
      if (["hi", "hello", "hey"].includes(m)) {
        return {
          role: "assistant",
          content:
            "Hi! I can help you with Schengen visa guidance. Ask me about documents, proofs, accommodation, travel, sponsorship, insurance, or interview prep. Which country are you applying for?",
        };
      }

      // 2. If user asks "what can you do"
      if (
        m.includes("what can you do") ||
        m.includes("what are you built for") ||
        m.includes("who are you")
      ) {
        return { role: "assistant", content: CAPABILITY_RESPONSE };
      }

      // 3. Reject non-Schengen, non-visa topics
      if (!isSchengenQuery(m)) {
        return {
          role: "assistant",
          content:
            "Sorry, I'm not built for that. I can only help with Schengen visa–related questions.",
        };
      }

      // 4. Otherwise — ALLOW normal response
      return null;
    },
  });

  // -----------------------------
  // CLIENT EFFECTS & STORAGE
  // -----------------------------
  useEffect(() => {
    setIsClient(true);
    setDurations(stored.durations);
    setMessages(stored.messages);
  }, []);

  useEffect(() => {
    if (isClient) saveMessagesToStorage(messages, durations);
  }, [messages, durations, isClient]);

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: { message: "" },
  });

  function onSubmit(data: any) {
    sendMessage({ text: data.message });
    form.reset();
  }

  function clearChat() {
    setMessages([]);
    setDurations({});
    saveMessagesToStorage([], {});
    toast.success("Chat cleared");
  }

  // -----------------------------
  // UI (unchanged)
  // -----------------------------
  return (
    <div className="relative flex h-screen items-center justify-center font-sans">
      <div
        className="absolute inset-0 bg-cover bg-center bg-fixed opacity-25"
        style={{ backgroundImage: "url('/bg-europe.png')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-sky-50/90 via-slate-50/95 to-blue-50/98 dark:from-slate-950/95 dark:via-slate-950/98 dark:to-black/95" />

      <main className="relative z-10 w-full h-screen">
        {/* HEADER */}
        <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-sky-900/90 via-sky-900/75 to-transparent pb-16 text-slate-50">
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
                  {AI_NAME}
                </p>
                <p className="text-[11px] text-slate-200">
                  Schengen visa guidance: documents, checklists & country-specific info.
                </p>
              </div>
            </ChatHeaderBlock>
            <ChatHeaderBlock className="justify-end">
              <Button
                variant="outline"
                size="sm"
                className="cursor-pointer"
                onClick={clearChat}
              >
                <Plus className="size-3 mr-1" /> {CLEAR_CHAT_TEXT}
              </Button>
            </ChatHeaderBlock>
          </ChatHeader>
        </div>

        {/* MESSAGES */}
        <div className="h-screen overflow-y-auto px-5 py-4 w-full pt-[92px] pb-[150px]">
          <MessageWall
            messages={messages}
            status={status}
            durations={durations}
            onDurationChange={(k: any, d: any) =>
              setDurations({ ...durations, [k]: d })
            }
          />

          {status === "submitted" && (
            <div className="flex justify-start max-w-3xl w-full mt-2">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>

        {/* INPUT BAR */}
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-slate-200/95 via-slate-100/90 to-transparent pt-13">
          <div className="w-full px-5 pt-5 pb-1 flex justify-center">
            <div className="max-w-3xl w-full">
              <form onSubmit={form.handleSubmit(onSubmit)}>
                <FieldGroup>
                  <Controller
                    name="message"
                    control={form.control}
                    render={({ field }) => (
                      <Field>
                        <div className="relative h-13">
                          <Input
                            {...field}
                            className="h-15 pr-14 pl-5 bg-white/90 rounded-2xl border border-sky-300"
                            placeholder='Example: "How do I apply for a France visa?"'
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                form.handleSubmit(onSubmit)();
                              }
                            }}
                          />
                          {(status === "ready" || status === "error") && (
                            <Button
                              className="absolute right-2 top-2 rounded-full h-10 w-10 bg-sky-700"
                              type="submit"
                            >
                              <ArrowUp className="size-4" />
                            </Button>
                          )}
                          {(status === "streaming" ||
                            status === "submitted") && (
                            <Button
                              className="absolute right-2 top-2 rounded-full h-10 w-10 bg-slate-900"
                              type="button"
                              onClick={stop}
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
        </div>
      </main>
    </div>
  );
}
