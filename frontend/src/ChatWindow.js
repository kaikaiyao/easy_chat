// ./frontend/src/ChatWindow.js
import React, { useState, useEffect, useRef, useCallback, memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { dracula } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Virtuoso } from "react-virtuoso";
import { FaCopy, FaStopCircle, FaPaperPlane } from "react-icons/fa";
import "katex/dist/katex.min.css";
import "./styles/ChatWindow.css";

// A custom CodeBlock component that mimics ChatGPT's code block copy behavior.
const CodeBlock = ({ inline, className, children, ...props }) => {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || "");
  const codeText = String(children).replace(/\n$/, "");

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(codeText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        console.error("Clipboard API not supported");
      }
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  if (!inline && match) {
    return (
      <div className="code-block-container" style={{ position: "relative" }}>
        <button
          className="copy-button"
          onClick={handleCopy}
          title="Copy code"
          style={{ position: "absolute", top: "8px", right: "8px" }}
        >
          {copied ? "Copied!" : <FaCopy size={14} />}
        </button>
        <SyntaxHighlighter
          language={match[1]}
          style={dracula}
          customStyle={{
            padding: "1em",
            borderRadius: "8px",
            margin: "1em 0",
            backgroundColor: "#282a36",
          }}
          PreTag="div"
          {...props}
        >
          {codeText}
        </SyntaxHighlighter>
      </div>
    );
  }
  return <code className={className} {...props}>{children}</code>;
};

const MemoizedMessage = memo(({ msg }) => {
  // Use the raw message content directly.
  const content = msg.content;

  const copyToClipboard = async (text) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        console.log("Text copied to clipboard");
      } else {
        console.error("Clipboard API not supported");
      }
    } catch (err) {
      console.error("Copy failed", err);
    }
  };

  // Define a style object for the message bubble wrapper to enforce relative positioning.
  const bubbleStyle = { position: "relative" };
  // Define a style for the copy button to ensure it sits at the top-right of the bubble.
  const buttonStyle = { position: "absolute", top: "8px", right: "8px" };

  // Convert new lines to <br> tags
  const formattedContent = { __html: content.replace(/\n/g, '<br>') };

  if (msg.role === "user") {
    return (
      <div className="message-group">
        <div className="message user" style={bubbleStyle}>
          <button className="copy-button" onClick={() => copyToClipboard(content)} style={buttonStyle}>
            <FaCopy size={14} />
          </button>
          <div className="content" dangerouslySetInnerHTML={formattedContent} />
        </div>
      </div>
    );
  }

  if (msg.role === "assistant" && msg.type === "thinking") {
    return (
      <div className="message-group">
        <div className="thinking-bubble" style={{ ...bubbleStyle }}>
          <button className="copy-button" onClick={() => copyToClipboard(content)} style={buttonStyle}>
            <FaCopy size={14} />
          </button>
          <details open>
            <summary className="think-header">Thinking Process</summary>
            <div className="think-content">
              <div dangerouslySetInnerHTML={formattedContent} />
              {msg.loading && <span className="loading-dots">...</span>}
            </div>
          </details>
        </div>
      </div>
    );
  }

  if (msg.role === "assistant" && msg.type === "warning") {
    return (
      <div className="message-group">
        <div className="message assistant warning" style={bubbleStyle}>
          <button className="copy-button" onClick={() => copyToClipboard(content)} style={buttonStyle}>
            <FaCopy size={14} />
          </button>
          <div className="content" dangerouslySetInnerHTML={formattedContent} />
        </div>
      </div>
    );
  }

  if (msg.role === "assistant" && msg.type === "final") {
    return (
      <div className="message-group">
        <div className="message assistant" style={bubbleStyle}>
          <button className="copy-button" onClick={() => copyToClipboard(content)} style={buttonStyle}>
            <FaCopy size={14} />
          </button>
          <ReactMarkdown
            className="markdown-content"
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex, rehypeRaw]}
            components={{
              code: CodeBlock,
            }}
          >
            {content}
          </ReactMarkdown>
          {msg.loading && <div className="loading-dots">...</div>}
        </div>
      </div>
    );
  }
  return null;
});

const ChatWindow = ({
  conversationId,
  isProcessing,
  setIsProcessing,
  controller,
  setController,
  settings,
  loadConversations,
}) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const virtuosoRef = useRef(null);
  const bottomRef = useRef(null);

  const loadMessages = useCallback(() => {
    if (conversationId) {
      fetch(`/api/conversations/${conversationId}`)
        .then((res) => res.json())
        .then((data) => {
          // Reset the loading state for all messages
          const updatedMessages = data.messages.map(msg => ({
            ...msg,
            loading: false
          }));
          setMessages(updatedMessages);
        })
        .catch(console.error);
    }
  }, [conversationId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isProcessing]);

  const abortRequest = () => {
    if (controller) {
      controller.abort();
      setIsProcessing(false);
      setMessages((prev) => {
        const newMessages = [...prev];
        const lastMsg = newMessages[newMessages.length - 1];
        if (lastMsg?.role === "assistant") {
          lastMsg.loading = false;
        }
        return newMessages;
      });
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isProcessing) return;
    const userInput = input;
    setInput("");
    setMessages((prev) => [
      ...prev,
      { role: "user", content: userInput, id: Date.now() },
    ]);
    if (!settings.api_key || !settings.base_url || !settings.model) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          type: "warning",
          content:
            "Warning: API settings missing. Configure or import them in the Settings panel.",
          id: Date.now() + 1,
          loading: false,
        },
      ]);
      return;
    }
    const newController = new AbortController();
    setController(newController);
    setIsProcessing(true);
    let thinkingMessageId = null;
    let finalMessageId = null;

    const processEvent = (data) => {
      switch (data.type) {
        case "user":
          break;
        case "think_start":
          setMessages((prev) => {
            const newMsg = {
              role: "assistant",
              type: "thinking",
              content: "",
              id: Date.now(),
              loading: true,
            };
            thinkingMessageId = newMsg.id;
            return [...prev, newMsg];
          });
          break;
        case "think":
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === thinkingMessageId
                ? { ...msg, content: msg.content + data.content }
                : msg
            )
          );
          break;
        case "think_end":
          setMessages((prev) => {
            const updated = prev.map((msg) =>
              msg.id === thinkingMessageId ? { ...msg, loading: false } : msg
            );
            thinkingMessageId = null;
            return updated;
          });
          break;
        case "assistant":
          if (finalMessageId) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === finalMessageId
                  ? { ...msg, content: msg.content + data.content }
                  : msg
              )
            );
          } else {
            const newMsg = {
              role: "assistant",
              type: "final",
              content: data.content,
              id: Date.now(),
              loading: true,
            };
            finalMessageId = newMsg.id;
            setMessages((prev) => [...prev, newMsg]);
          }
          break;
        case "title_update":
          if (typeof loadConversations === "function") {
            loadConversations();
          }
          break;
        default:
          console.warn("Unexpected data type:", data.type);
          break;
      }
    };

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: conversationId,
          message: userInput,
          base_url: settings.base_url,
          api_key: settings.api_key,
          model: settings.model,
          temperature: settings.temperature,
          top_p: settings.top_p,
        }),
        signal: newController.signal,
      });
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop();
        for (const part of parts) {
          if (!part.startsWith("data: ")) continue;
          const jsonStr = part.substring(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const data = JSON.parse(jsonStr);
            processEvent(data);
          } catch (error) {
            console.error("Error parsing SSE event", error);
          }
        }
      }
      buffer += decoder.decode(new Uint8Array(), { stream: false });
      if (buffer) {
        const parts = buffer.split("\n\n");
        for (const part of parts) {
          if (!part.startsWith("data: ")) continue;
          const jsonStr = part.substring(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            JSON.parse(jsonStr);
          } catch (error) {
            console.error("Error parsing final SSE event", error);
          }
        }
      }
    } catch (e) {
      console.error("Error in sendMessage:", e);
    } finally {
      setIsProcessing(false);
      setController(null);
      setMessages((prev) =>
        prev.map((msg) => (msg.loading ? { ...msg, loading: false } : msg))
      );
    }
  };

  return (
    <div className="chat-window">
      <div className="messages">
        <Virtuoso
          data={messages}
          ref={virtuosoRef}
          initialTopMostItemIndex={messages.length - 1}
          itemContent={(index, msg) => <MemoizedMessage msg={msg} />}
          followOutput="auto"
          style={{ height: "100%" }}
          components={{
            Footer: () => <div ref={bottomRef} />,
          }}
        />
      </div>
      <div className="input-area">
        <textarea
          className="input-textarea"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !isProcessing) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder="Type your message..."
          disabled={isProcessing}
          rows="5"
        />
        <div className="button-container">
          {isProcessing ? (
            <button className="stop-button" onClick={abortRequest}>
              <FaStopCircle size={18} />
            </button>
          ) : (
            <button
              onClick={sendMessage}
              disabled={isProcessing || !input.trim()}
              className="send-button"
            >
              <FaPaperPlane size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatWindow;