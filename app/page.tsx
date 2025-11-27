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

/* -----------------------------
   FORM SCHEMA
--------------------------------*/
const formSchema = z.object({
  message: z
    .string()
    .min(1, "Message cannot be empty.")
    .max(2000, "Message must be at most 2000 characters."),
});

const STORAGE_KEY = "chat-messages";

type StorageData = {
  messages: UIMessage[];
  durations: Record<string, number>;
};

const loadMessagesFromStorage = (): StorageData => {
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
    console.error("Failed to save messages from localStorage:", error);
  }
};

/* -----------------------------
   SCHENGEN FILTER & CAPABILITIES
--------------------------------*/

// Non-Schengen countries we want to actively block
const NON_SCHENGEN_COUNTRIES = [
  "usa",
  "u.s.",
  "united states",
  "america",
  "canada",
  "uk",
  "u.k.",
  "england",
  "britain",
  "united kingdom",
  "australia",
  "new zealand",
  "singapore",
  "uae",
  "dubai",
  "qatar",
  "saudi",
  "china",
  "japan",
  "south korea",
  "ireland",
  "mexico",
  "brazil",
];

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

const SCHENGEN_CITIES = [
  "paris",
  "berlin",
  "munich",
  "frankfurt",
  "rome",
  "milan",
  "venice",
  "florence",
  "madrid",
  "barcelona",
  "valencia",
  "lisbon",
  "porto",
  "vienna",
  "prague",
  "zurich",
  "geneva",
  "oslo",
  "stockholm",
  "copenhagen",
  "helsinki",
  "brussels",
  "budapest",
  "warsaw",
  "krakow",
  "amsterdam",
  "rotterdam",
  "the hague",
];

const VISA_KEYWORDS = [
  "visa",
  "schengen",
  "vfs",
  "tlscontact",
  "bls",
  "embassy",
  "consulate",
  "appointment",
  "biometric",
  "vac centre",
  "visa application centre",
  "travel insurance",
  "itinerary",
  "proof of funds",
];

function isSchengenQuery(text: string): boolean {
  const m = text.toLowerCase();

  // If it clearly mentions a non-Schengen country -> reject
  if (NON_SCHENGEN_COUNTRIES.some((c) => m.includes(c))) {
    return false;
  }

  // If it explicitly says "schengen"
  if (m.includes("schengen")) return true;

  // If it mentions any Schengen country or city -> accept
  if (SCHENGEN_COUNTRIES.some((c) => m.includes(c))) return true;
  if (SCHENGEN_CITIES.some((c) => m.includes(c))) return true;

  // Generic visa language (no explicit non-Schengen country) -> treat as Schengen
  if (VISA_KEYWORDS.some((k) => m.includes(k))) return true;

  return false;
}

const CAPABILITY_RESPONSE = `Here’s what I can help you with:

• Documents required  
• Financial proofs  
• Accommodation proofs  
• Transport proofs  
• Sponsorship  
• Insurance  
• Special category documents  
• Interview prep questions`;

/* -----------------------------
   MAIN CHAT COMPONENT
--------------------------------*/

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

    async onSend(message) {
      const m = message.text.toLowerCase().trim();

      // Friendly greeting
      if (["hi", "hello", "hey"].includes(m)) {
        return {
          role: "assistant",
          content:
            "Hi! I can help you with Schengen visa guidance. Which country are you applying to and what is the purpose of your trip?",
        };
      }

      // "What do you do" / "what can you do" / similar
      if (
        m.includes("what do you do") ||
        m.includes("what can you do") ||
        m.includes("what are you built for") ||
        m.includes("who are you") ||
        m.includes("your purpose") ||
        m.includes("your skills") ||
        m.includes("what help") ||
        m.includes("how can you help")
      ) {
        return {
          role: "assistant",
          content: CAPABILITY_RESPONSE,
        };
      }

      // Restrict to Schengen visa questions only
      if (!isSchengenQuery(m)) {
        return {
          role: "assistant",
          content:
            "Sorry, I’m only built to answer Schengen visa questions.",
        };
      }

      // For valid Schengen visa questions, let the model answer normally
      return null;
    },
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
    sendMessage({ text: data.message });
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
        <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-sky-900/90 via-sky-900/75 to-transparent dark:from-sky-950 dark:via-sky-950/95 dark:to-transparent pb-16 text-slate-50">
          <div className="relative">
            <ChatHeader>
              {/* left spacer */}
              <ChatHeaderBlock />

              {/* center block: EU visa assistant */}
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
                    Get guidance on Schengen short-stay visas: documents,
                    checklists, consulate rules, VFS steps & timelines.
                  </p>
                </div>
              </ChatHeaderBlock>

              {/* right: new chat */}
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
                            placeholder='Example: "Indian applicant going to France for 10 days. What documents do I need?"'
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
