'use client';

import { useState, useRef } from 'react';
import { useChat } from '@ai-sdk/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { MetricsDashboard } from '@/components/metrics-dashboard';
import { Loader2, Send, Upload, FileText, Settings2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

export default function ChatPage() {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<'rag' | 'full'>('rag');
  const [metrics, setMetrics] = useState({ inputTokens: 0, outputTokens: 0, latency: 0 });
  const [localInput, setLocalInput] = useState('');
  const startTimeRef = useRef<number>(0);

  const chatHelpers = useChat({

    onResponse: (response: any) => {
      const endTime = Date.now();
      setMetrics(prev => ({ ...prev, latency: endTime - startTimeRef.current }));
    },
    onFinish: (message: any, options: any) => {
      const usage = options?.usage;
      const inputLength = messages.reduce((acc: any, m: any) => acc + m.content.length, 0) + (file ? 10000 : 0); // Rough estimate if usage missing
      const outputLength = message.content.length;

      setMetrics(prev => ({
        ...prev,
        inputTokens: usage?.promptTokens || Math.ceil(inputLength / 4),
        outputTokens: usage?.completionTokens || Math.ceil(outputLength / 4),
      }));
    },
    onError: (error: any) => {
      console.error("Chat error:", error);
    },
  } as any);
  console.log("chatHelpers:", chatHelpers);
  const { messages, sendMessage, isLoading, stop, error, regenerate } = chatHelpers as any;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!file) {
      alert("Please upload a PDF file first.");
      return;
    }
    if (!localInput) return;

    const userMessage = { role: 'user', content: localInput, id: Date.now().toString() };
    const newMessages = [...messages, userMessage];
    // @ts-ignore
    chatHelpers.setMessages(newMessages);
    setLocalInput('');
    startTimeRef.current = Date.now();

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const base64File = reader.result as string;

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: newMessages,
            file: base64File,
            mode: mode
          }),
        });

        if (!response.ok) {
          throw new Error(await response.text());
        }

        if (response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let assistantMessage = { role: 'assistant', content: '', id: (Date.now() + 1).toString() };
          // @ts-ignore
          chatHelpers.setMessages([...newMessages, assistantMessage]);

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });

            // Append chunk to assistant message content
            assistantMessage.content += chunk;

            // Update messages state
            // @ts-ignore
            chatHelpers.setMessages([...newMessages, { ...assistantMessage }]);
          }

          // Calculate metrics manually since we bypass useChat callbacks
          const endTime = Date.now();
          const latency = endTime - startTimeRef.current;

          // Estimate tokens (4 chars ~= 1 token)
          const inputLength = newMessages.reduce((acc: any, m: any) => acc + m.content.length, 0) + (file ? 10000 : 0);
          const outputLength = assistantMessage.content.length;

          setMetrics(prev => ({
            ...prev,
            latency,
            inputTokens: Math.ceil(inputLength / 4),
            outputTokens: Math.ceil(outputLength / 4),
          }));
        }
      } catch (err) {
        console.error("Error in onSubmit:", err);
      }
    };
  };

  return (
    <div className="container mx-auto p-4 max-w-6xl h-screen flex flex-col gap-4">
      <header className="flex items-center justify-between py-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">RAG vs Full Context</h1>
          <p className="text-muted-foreground">Compare LLM strategies with Gemini 2.5 Flash</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={mode === 'rag' ? 'default' : 'secondary'}>
            Current Mode: {mode === 'rag' ? 'RAG' : 'Full Context'}
          </Badge>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 flex-1 overflow-hidden">
        {/* Sidebar / Configuration */}
        <Card className="md:col-span-1 flex flex-col h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="w-5 h-5" />
              Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 flex-1">
            <div className="space-y-2">
              <Label htmlFor="file-upload">Document (PDF)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="file-upload"
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  className="w-full justify-start text-muted-foreground"
                  onClick={() => document.getElementById('file-upload')?.click()}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {file ? file.name : "Select PDF..."}
                </Button>
              </div>
              {file && (
                <div className="text-xs text-green-600 flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  {file.name} loaded
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Strategy</Label>
              <Tabs value={mode} onValueChange={(v) => setMode(v as 'rag' | 'full')} className="w-full">
                <TabsList className="w-full">
                  <TabsTrigger value="rag" className="flex-1">RAG</TabsTrigger>
                  <TabsTrigger value="full" className="flex-1">Full Context</TabsTrigger>
                </TabsList>
              </Tabs>
              <p className="text-xs text-muted-foreground mt-2">
                {mode === 'rag'
                  ? "Retrieves relevant chunks based on query. Efficient for large docs."
                  : "Sends entire document content. Higher accuracy but higher cost/latency."}
              </p>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Metrics</Label>
              <MetricsDashboard
                inputTokens={metrics.inputTokens}
                outputTokens={metrics.outputTokens}
                latency={metrics.latency}
                className="grid-cols-1"
              />
            </div>
          </CardContent>
        </Card>

        {/* Chat Area */}
        <Card className="md:col-span-3 flex flex-col h-full overflow-hidden">
          <CardHeader className="border-b">
            <CardTitle>Chat Session</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
            <ScrollArea className="h-full p-4">
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
                  <FileText className="w-12 h-12 mb-4" />
                  <p>Upload a PDF and start chatting to compare strategies.</p>
                </div>
              )}
              <div className="space-y-4">
                {messages.map((m: any) => (
                  <div
                    key={m.id}
                    className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-2 ${m.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                        }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-lg px-4 py-2 flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Thinking...</span>
                    </div>
                  </div>
                )}
                {error && (
                  <div className="flex justify-center">
                    <div className="bg-destructive/10 text-destructive rounded-lg px-4 py-2 text-sm">
                      Error: {error.message}
                      <Button variant="link" size="sm" onClick={() => regenerate()} className="ml-2 text-destructive">Retry</Button>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
          <CardFooter className="border-t p-4">
            <form onSubmit={onSubmit} className="flex w-full gap-2">
              <Input
                value={localInput}
                onChange={(e) => setLocalInput(e.target.value)}
                placeholder="Ask something about the document..."
                disabled={isLoading || !file}
              />
              <Button type="submit" disabled={isLoading || !file}>
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span className="sr-only">Send</span>
              </Button>
            </form>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
