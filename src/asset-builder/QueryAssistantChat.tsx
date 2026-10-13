import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  ArrowUp,
  At,
  Microphone,
  Paperclip,
  X,
} from "@phosphor-icons/react";

type QueryChatMessage =
  | { id: string; role: "user"; text: string }
  | {
      id: string;
      role: "assistant";
      text: string;
      code?: string;
      status?: string;
    };

export type QueryAssistantResult = {
  text: string;
  code?: string;
  status?: string;
};

function messageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function conversationTitle(messages: QueryChatMessage[], initialTitle: string) {
  const firstPrompt = messages.find((message) => message.role === "user")?.text;
  if (!firstPrompt) return initialTitle;
  const compact = firstPrompt.replace(/\s+/g, " ").trim();
  return compact.length > 40 ? `${compact.slice(0, 39)}…` : compact;
}

export default function QueryAssistantChat({
  onClose,
  onGenerate,
  initialTitle = "Create SQL query with AI",
  introTitle = "Describe the query you want to create.",
  introExample = 'Example: "Show all customers from last week".',
  placeholder = "Ask about anything",
  thinkingText = "Generating your SQL query…",
}: {
  onClose: () => void;
  onGenerate: (prompt: string) => string | QueryAssistantResult;
  initialTitle?: string;
  introTitle?: string;
  introExample?: string;
  placeholder?: string;
  thinkingText?: string;
}) {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<QueryChatMessage[]>([]);
  const [generating, setGenerating] = useState(false);
  const [schemaAttached, setSchemaAttached] = useState(false);
  const [listening, setListening] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const generationTimer = useRef<number | null>(null);

  const title = useMemo(
    () => conversationTitle(messages, initialTitle),
    [initialTitle, messages],
  );
  const hasMessages = messages.length > 0;
  const canSend = draft.trim().length > 0;

  const stopGenerating = () => {
    if (generationTimer.current !== null) {
      window.clearTimeout(generationTimer.current);
      generationTimer.current = null;
    }
    setGenerating(false);
  };

  const send = () => {
    const prompt = draft.trim();
    if (!prompt || generating) return;

    setMessages((current) => [
      ...current,
      { id: messageId(), role: "user", text: prompt },
    ]);
    setDraft("");
    setGenerating(true);
    setListening(false);

    generationTimer.current = window.setTimeout(() => {
      const result = onGenerate(prompt);
      const response =
        typeof result === "string"
          ? {
              text: "I generated this SQL query and applied it to the editor.",
              code: result,
              status: "Applied to query editor",
            }
          : result;
      setMessages((current) => [
        ...current,
        {
          id: messageId(),
          role: "assistant",
          ...response,
        },
      ]);
      setGenerating(false);
      generationTimer.current = null;
    }, 900);
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  };

  useEffect(() => {
    textareaRef.current?.focus();
    return () => {
      if (generationTimer.current !== null) {
        window.clearTimeout(generationTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  useEffect(() => {
    const transcript = transcriptRef.current;
    if (!transcript) return;
    transcript.scrollTo({ top: transcript.scrollHeight, behavior: "smooth" });
  }, [messages, generating]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 112)}px`;
  }, [draft]);

  return (
    <section className="ds-query-chat" aria-label="Llumen SQL assistant">
      <header className="ds-query-chat__header">
        <span className="ds-query-chat__title">{title}</span>

        <div className="ds-query-chat__header-actions">
          <button type="button" aria-label="Close Llumen assistant" onClick={onClose}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
      </header>

      <div
        ref={transcriptRef}
        className={
          "ds-query-chat__middle" +
          (hasMessages ? "" : " ds-query-chat__middle--empty")
        }
      >
        {!hasMessages ? (
          <div className="ds-query-chat__hero">
            <div>
              <p>{introTitle}</p>
              <small>{introExample}</small>
            </div>
          </div>
        ) : (
          <div className="ds-query-chat__transcript">
            {messages.map((message) =>
              message.role === "user" ? (
                <div className="ds-query-chat__user-row" key={message.id}>
                  <p>{message.text}</p>
                </div>
              ) : (
                <div className="ds-query-chat__assistant-message" key={message.id}>
                  <p>{message.text}</p>
                  {message.code && (
                    <pre>
                      <code>{message.code}</code>
                    </pre>
                  )}
                  {message.status && <span>{message.status}</span>}
                </div>
              ),
            )}
            {generating && (
              <div className="ds-query-chat__thinking" role="status">
                <p>{thinkingText}</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="ds-query-chat__composer">
        {schemaAttached && (
          <div className="ds-query-chat__context">
            <span>Current schema</span>
            <button
              type="button"
              aria-label="Remove current schema"
              onClick={() => setSchemaAttached(false)}
            >
              <X size={12} aria-hidden="true" />
            </button>
          </div>
        )}
        <textarea
          ref={textareaRef}
          rows={1}
          value={draft}
          aria-label={hasMessages ? "Reply" : "Message"}
          placeholder={hasMessages ? "Reply..." : placeholder}
          disabled={generating}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleComposerKeyDown}
        />
        <div className="ds-query-chat__composer-actions">
          <div>
            <button
              type="button"
              className={schemaAttached ? "is-active" : ""}
              aria-label="Attach current schema"
              aria-pressed={schemaAttached}
              onClick={() => setSchemaAttached((attached) => !attached)}
            >
              <Paperclip size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Mention schema"
              onClick={() => {
                setDraft((current) => `${current}${current ? " " : ""}@schema `);
                requestAnimationFrame(() => textareaRef.current?.focus());
              }}
            >
              <At size={18} aria-hidden="true" />
            </button>
          </div>
          <div>
            <button
              type="button"
              className={listening ? "is-active" : ""}
              aria-label={listening ? "Stop voice input" : "Voice input"}
              aria-pressed={listening}
              onClick={() => setListening((value) => !value)}
            >
              <Microphone size={20} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={
                "ds-query-chat__send" +
                (generating
                  ? " is-generating"
                  : canSend
                    ? " is-active"
                    : "")
              }
              aria-label={generating ? "Stop generating" : "Send message"}
              disabled={!canSend && !generating}
              onClick={generating ? stopGenerating : send}
            >
              {generating ? <i /> : <ArrowUp size={20} weight={canSend ? "bold" : "regular"} />}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
