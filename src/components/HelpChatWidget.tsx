import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  navigationLink?: string;
}

// Navigation routes mapping
const NAVIGATION_ROUTES: Record<string, { path: string; name: string }> = {
  "project management": { path: "/project-mgmt", name: "Project Management" },
  "project": { path: "/project-mgmt", name: "Project Management" },
  "projects": { path: "/project-mgmt", name: "Project Management" },
  "dashboard": { path: "/project-mgmt/dashboard", name: "Admin Dashboard" },
  "admin dashboard": { path: "/project-mgmt/dashboard", name: "Admin Dashboard" },
  "pm dashboard": { path: "/project-mgmt/pm-dashboard", name: "PM Dashboard" },
  "ar dashboard": { path: "/project-mgmt/ar-dashboard", name: "AR Dashboard" },
  "my tasks": { path: "/project-mgmt/ar-dashboard", name: "My Tasks" },
  "plan checker": { path: "/ai-plan-checker", name: "AI Plan Checker" },
  "checklist": { path: "/ai-plan-checker", name: "AI Plan Checker" },
  "feasibility": { path: "/ai-feasibility", name: "AI Feasibility" },
  "compliance chat": { path: "/ai-compliance-chat", name: "AI Compliance Chat" },
  "team activity": { path: "/project-mgmt/team-activity", name: "Team Activity" },
  "board": { path: "/project-mgmt/board", name: "Project Board" },
  "home": { path: "/", name: "Home" },
};

export const HelpChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hi! 👋 I'm your zHeight assistant. Ask me anything about building codes, compliance, or how to use the platform!",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Check if user is asking for navigation help
  const checkForNavigation = (query: string): { path: string; name: string } | null => {
    const lowerQuery = query.toLowerCase();
    
    // Check for navigation intent
    const navPhrases = ["take me to", "go to", "navigate to", "open", "show me", "where is", "how do i get to", "bring me to"];
    const hasNavIntent = navPhrases.some(phrase => lowerQuery.includes(phrase));
    
    if (hasNavIntent) {
      for (const [keyword, route] of Object.entries(NAVIGATION_ROUTES)) {
        if (lowerQuery.includes(keyword)) {
          return route;
        }
      }
    }
    
    return null;
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const userInput = input.trim();
    setInput("");
    setIsLoading(true);

    try {
      // First check if this is a navigation request
      const navRoute = checkForNavigation(userInput);
      
      if (navRoute) {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: `I'll take you to ${navRoute.name}. Click the button below or I'll navigate you there automatically.`,
          navigationLink: navRoute.path,
        };
        setMessages((prev) => [...prev, assistantMessage]);
        
        // Auto-navigate after a short delay
        setTimeout(() => {
          navigate(navRoute.path);
          setIsOpen(false);
        }, 1500);
        
        setIsLoading(false);
        return;
      }

      // Otherwise, query the AI knowledge base
      const { data, error } = await supabase.functions.invoke('ai-compliance-chat', {
        body: { 
          message: userInput,
          sessionId: sessionId 
        }
      });

      if (error) {
        throw error;
      }

      // Save session ID for conversation continuity
      if (data?.sessionId && !sessionId) {
        setSessionId(data.sessionId);
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data?.message || "I'm sorry, I couldn't process your request. Please try again.",
      };
      setMessages((prev) => [...prev, assistantMessage]);
      
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "I'm having trouble connecting right now. Please try again in a moment.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    setIsOpen(false);
  };

  return (
    <>
      {/* Chat Widget Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 left-6 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all duration-200 flex items-center justify-center hover:scale-105"
        aria-label={isOpen ? "Close help chat" : "Open help chat"}
      >
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <MessageCircle className="h-6 w-6" />
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 left-6 z-50 w-80 sm:w-96 bg-background border border-border rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-5 duration-200">
          {/* Header */}
          <div className="bg-primary px-4 py-3 flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-primary-foreground/20 flex items-center justify-center">
              <MessageCircle className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-primary-foreground text-sm">zHeight Assistant</h3>
              <p className="text-xs text-primary-foreground/70">Ask about codes, compliance & more</p>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="h-72 p-4" ref={scrollRef}>
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex flex-col ${message.role === "user" ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    {message.content}
                  </div>
                  {message.navigationLink && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      onClick={() => handleNavigate(message.navigationLink!)}
                    >
                      Go there now →
                    </Button>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg px-3 py-2 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Thinking...</span>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="border-t border-border p-3 flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask about codes, or 'take me to...'"
              className="flex-1 text-sm"
              disabled={isLoading}
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
};