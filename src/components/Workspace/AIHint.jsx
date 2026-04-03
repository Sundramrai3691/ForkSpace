import axios from "axios";
import { useState, useRef } from "react";
import toast from "react-hot-toast";

export default function useAIHint(editorRef, socketRef, roomId) {
  const aiServerUrl = (import.meta.env.VITE_AI_SERVER_URL || "").trim();
  const aiEnabled = import.meta.env.VITE_ENABLE_AI === "true" && Boolean(aiServerUrl);
  const [ghostHint, setGhostHint] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [aiHints, setAiHints] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const ghostMarkerRef = useRef(null);
  const hasShownAiError = useRef(false);

  const notifyAiUnavailable = (message) => {
    if (!hasShownAiError.current) {
      toast.error(message);
      hasShownAiError.current = true;
    }
  };

  const showGhostHint = (hint) => {
    clearGhostHint();
    setGhostHint(hint);

    const cm = editorRef.current;
    if (!cm) return;

    const cursor = cm.getCursor();

    ghostMarkerRef.current = cm.setBookmark(cursor, {
      widget: (() => {
        const span = document.createElement("span");
        span.style.opacity = "0.5";
        span.style.color = "#999";
        span.style.fontFamily = "monospace";
        span.style.pointerEvents = "none";
        span.textContent = hint;
        return span;
      })(),
    });
  };

  const acceptGhostHint = () => {
    if (!ghostHint) return;
    const cm = editorRef.current;
    if (!cm) return;

    cm.replaceSelection(ghostHint);
    clearGhostHint();

    socketRef.current.emit("code-change", {
      roomId,
      code: cm.getValue(),
    });
  };

  const clearGhostHint = () => {
    if (ghostMarkerRef.current) {
      ghostMarkerRef.current.clear();
      ghostMarkerRef.current = null;
    }
    setGhostHint("");
  };

  const fetchHint = async () => {
    if (!editorRef.current) return;
    if (!aiEnabled) {
      notifyAiUnavailable("AI hints are disabled. Set VITE_ENABLE_AI=true and configure VITE_AI_SERVER_URL to use them.");
      return;
    }

    const cm = editorRef.current;
    const cursor = cm.getCursor();

    const code = cm.getValue();
    const beforeCursor = code.substring(0, cm.indexFromPos(cursor));
    const afterCursor = code.substring(cm.indexFromPos(cursor));

    try {
      const res = await axios.post(`${aiServerUrl}/api/ai-hint`, {
        prompt: beforeCursor,
        suffix: afterCursor,
      });

      const { hint } = res.data; 
      // console.log("AI Hint:", hint);

      if (hint && hint.trim()) {
        hasShownAiError.current = false;
        showGhostHint(hint);
      }
    } catch {
      notifyAiUnavailable("AI hints server is unavailable. Start the AI server and try again.");
    }
  };

  const fetchAIHints = async () => {
    if (!editorRef.current) return;
    if (!aiEnabled) {
      notifyAiUnavailable("AI suggestions are disabled. Set VITE_ENABLE_AI=true and configure VITE_AI_SERVER_URL to use them.");
      return;
    }
    
    setIsLoading(true);
    setShowDropdown(true);
    
    const cm = editorRef.current;
    const code = cm.getValue();
    const cursor = cm.getCursor();
    const beforeCursor = code.substring(0, cm.indexFromPos(cursor));
    const afterCursor = code.substring(cm.indexFromPos(cursor));

    try {
      const res = await axios.post(`${aiServerUrl}/api/ai-hints`, {
        code: code,
        cursor: cm.indexFromPos(cursor),
        beforeCursor: beforeCursor,
        afterCursor: afterCursor,
      });

      const { hints } = res.data;
      hasShownAiError.current = false;

      if (hints && Array.isArray(hints)) {
        setAiHints(hints);
      } else {
        setAiHints([]);
      }
    } catch {
      setAiHints([]);
      setShowDropdown(false);
      notifyAiUnavailable("AI hints server is unavailable. Start the AI server and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const closeDropdown = () => {
    setShowDropdown(false);
    setAiHints([]);
  };

  const applyHint = (hint) => {
    if (!editorRef.current) return;
    const cm = editorRef.current;
    
    cm.replaceSelection(hint);
    closeDropdown();

    socketRef.current.emit("code-change", {
      roomId,
      code: cm.getValue(),
    });
  };

  return {
    ghostHint,
    showGhostHint,
    acceptGhostHint,
    clearGhostHint,
    fetchHint,
    showDropdown,
    aiHints,
    isLoading,
    fetchAIHints,
    closeDropdown,
    applyHint,
  };
}
