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
// FORM SCHEMA
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

const saveMessagesToStorage = (messages, durations) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ messages, durations }));
};

// -----------------------------
// SCHENGEN COUNTRIES + CITY DETECTION
// -----------------------------
const SCHENGEN_KEYWORDS = [
  "france", "paris",
  "germany", "berlin",
  "italy", "rome", "milan",
  "spain", "madrid", "barcelona",
  "portugal", "lisbon",
  "finland", "helsinki",
  "sweden", "stockholm",
  "austria", "vienna",
  "belgium", "brussels",
  "poland", "warsaw",
  "norway", "oslo",
  "denmark", "copenhagen",
  "estonia", "tallinn",
  "latvia", "riga",
  "lithuania", "vilnius",
  "slovakia", "slovenia",
  "hungary", "budapest",
  "netherlands", "amsterdam",
  "luxembourg",
  "iceland", "reykjavik",
  "liechtenstein",
  "switzerland", "zurich",
  "greece", "athens",
  "malta", "czech", "prague"
];

// detect if message relates to schengen visas
function isSchengenQuery(msg) {
  const m = msg.toLowerCase();

  if (m.includes("visa") || m.includes("schengen") || m.includes("vfs") || m.includes("embassy") || m.includes("consulate"))
    return true;

  if (SCHENGEN_KEYWORDS.some((c) => m.includes(c))) return true;

  return false;
}

// “What can you do?” fixed answer
const CAPABILITY_TEXT = `
Here’s what I can help you with:

• Documents required  
• Financial proofs  
• Accommodation proofs  
• Transport proofs  
• Sponsorship  
• Insurance  
• Special category documents  
• Interview prep questions
`;

// -----------------------------
// MAIN CHAT COMPONENT
// -----------------------------
export default function Chat() {
  const [isClient, setIsClient] = useState(false);
  const [durations, setDurations] = useState({});
  const welcomeMessageShownRef = useRef(false);

  const stored = typeof window !== "undefined" ? loadMessagesFromStorage() : { messages: [], durations: {} };
  const [initialMessages] = useState(stored.messages);

  const { messages, sendMessage, status, stop, setMessages } = useChat({
    messages: initialMessages,

    async onSend(message) {
      const m = message.text.toLowerCase();

      // --- friendly greeting ---
      if (["hi", "hello", "hey"].includes(m)) {
        return {
          role: "assistant",
          content: "Hi! I can help you with Schengen visa guidance. Which country are you applying to?"
        };
      }

      // --- what do you do? ---
      if (
        m.includes("what do you do") ||
        m.includes("what can you do") ||
        m.includes("what are you built for") ||
        m.includes("who are you") ||
        m.includes("your purpose") ||
        m.includes("your skills")
      ) {
        return { role: "assistant", content: CAPABILITY_TEXT };
      }

      // --- reject non-schengen topics ---
      if (!isSchengenQuery(m)) {
        return {
          role: "assistant",
          content: "Sorry, I’m only built to answer Schengen visa questions."
        };
      }

      // DEFAULT → allow model to answer normally
      return null;
    }
  });

  // -----------------------------
  // STORAGE EFFECTS
  // -----------------------------
  useEffect(() => {
    setIsClient(true);
    setDurations(stored.durations);
    setMessages(stored.messages);
  }, []);

  useEffect(() => {
    if (isClient) saveMessagesToStorage(messages, durations);
  }, [messages, durations, isClient]);

  // -----------------------------
  // FORM HANDLING
  // -----------------------------
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: { message: "" },
  });

  function onSubmit(data) {
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

      {/* Background */}
      <div className="absolute inset-0 bg-cover bg-center bg-fixed opacity-25"
        style={{ backgroundImage: "url('/bg-europe.png')" }} />
      <div className="absolute inset-0 bg-gradient-to-b from-sky-50/90 via-slate-50/95 to-blue-50/98" />

      <main className="relative z-10 w-full h-screen">
        
        {/* HEADER */}
        <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-sky-900/90 via-sky-900/75 to-transparent pb-16 text-slate-50">
          <ChatHeader>
            <ChatHeaderBlock />
            <ChatHeaderBlock className="justify-center items-center gap-3">

              <Avatar className="size-9 ring-2 ring-yellow-300 shadow-sm bg-sky-900">
                <AvatarImage src="/eu-flag.png" />
                <AvatarFallback className="bg-sky-900 text-yellow-300 text-xs font-semibold">EU</AvatarFallback>
              </Avatar>

              <div className="flex flex-col">
                <p className="text-sm font-semibold tracking-tight">{AI_NAME || "Schengen Visa Assistant"}</p>
                <p className="text-[11px] text-slate-200">
                  Schengen visa guidance for Indian travellers.
                </p>
              </div>

            </ChatHeaderBlock>

            <ChatHeaderBlock className="justify-end">
              <Button variant="outline" size="sm" onClick={clearChat}>
                <Plus className="size-3 mr-1" /> {CLEAR_CHAT_TEXT}
              </Button>
            </ChatHeaderBlock>
          </ChatHeader>
        </div>

        {/* MESSAGES */}
        <div className="h-screen overflow-y-auto px-5 py-4 pt-[92px] pb-[150px]">
          <MessageWall
            messages={messages}
            status={status}
            durations={durations}
            onDurationChange={(k, d) => setDurations({ ...durations, [k]: d })}
          />

          {status === "submitted" && (
            <div className="flex justify-start max-w-3xl w-full mt-2">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>

        {/* INPUT BAR */}
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-slate-200/95 via-slate-100/90 pt-13">
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
                            placeholder='Example: "France and Italy visa together — what documents do I need?"'
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

                          {(status === "streaming" || status === "submitted") && (
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

          <div className="w-full px-5 py-3 flex justify-center text-[11px] text-muted-foreground">
            © {new Date().getFullYear()} {OWNER_NAME} · Schengen Visa Assistant · Powered by Ringel.ai
          </div>
        </div>

      </main>
    </div>
  );
}
