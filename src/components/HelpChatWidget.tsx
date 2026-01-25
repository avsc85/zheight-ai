import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export const HelpChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hi! 👋 I'm your zHeight assistant. How can I help you navigate the platform today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // Simple help responses based on keywords
    setTimeout(() => {
      const response = getHelpResponse(userMessage.content.toLowerCase());
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response,
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsLoading(false);
    }, 500);
  };

  const getHelpResponse = (query: string): string => {
    // Navigation help
    if (query.includes("project") && (query.includes("manage") || query.includes("setup") || query.includes("create"))) {
      return "To manage projects, click on 'Project Mgmt' in the top navigation. From there you can create new projects, assign team members, and track milestones.";
    }
    
    if (query.includes("checklist") || query.includes("extract")) {
      return "The Checklist Extractor (Agent 1) helps you extract compliance checklists from plan check documents. Go to 'AI Plan Checker' and upload your PDF documents.";
    }
    
    if (query.includes("plan") && query.includes("check")) {
      return "The Plan Checker (Agent 2) verifies your architectural plans against compliance requirements. Navigate to 'AI Plan Checker' to upload plans and run analysis.";
    }
    
    if (query.includes("feasibility") || query.includes("analyze")) {
      return "The Feasibility Checker (Agent 3) helps analyze residential single-family house feasibility. Go to 'AI Feasibility' and enter a property address to get started.";
    }
    
    if (query.includes("dashboard")) {
      return "Your dashboard depends on your role:\n• Admins: Access Admin Dashboard from your profile menu\n• Project Managers: PM Dashboard shows your assigned projects\n• ARs: My Tasks shows your assigned work items";
    }
    
    if (query.includes("task") || query.includes("ar")) {
      return "Tasks are managed through the Project Board. ARs can update task status and add notes. PMs can assign tasks and set due dates.";
    }
    
    if (query.includes("login") || query.includes("sign") || query.includes("account")) {
      return "Click the 'Sign In' button in the top right corner. If you don't have an account, contact your administrator to send you an invitation.";
    }
    
    if (query.includes("help") || query.includes("support")) {
      return "I'm here to help you navigate zHeight! You can ask me about:\n• Project management\n• AI tools (Checklist, Plan Checker, Feasibility)\n• Dashboards and tasks\n• Account access";
    }

    // Default response
    return "I can help you navigate zHeight! Try asking about:\n• How to manage projects\n• Using AI plan checking tools\n• Running feasibility analysis\n• Finding your dashboard\n• Task management";
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
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
              <h3 className="font-semibold text-primary-foreground text-sm">zHeight Help</h3>
              <p className="text-xs text-primary-foreground/70">Ask me anything about the platform</p>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="h-72 p-4" ref={scrollRef}>
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
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
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg px-3 py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
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
              placeholder="Type your question..."
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