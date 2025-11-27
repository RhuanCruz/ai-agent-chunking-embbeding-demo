import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText, convertToCoreMessages, UIMessage } from 'ai';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { SimpleVectorStore } from '@/lib/vector-store';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { TaskType } from '@google/generative-ai';

const google = createGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
    console.log("API /api/chat called");
    try {
        const pdf = require('pdf-parse-new');
        const { messages, file: base64File, mode } = await req.json();

        console.log("Received messages type:", typeof messages);
        console.log("Received messages isArray:", Array.isArray(messages));
        console.log("Received messages length:", messages?.length);

        if (!base64File) {
            return new Response('No file uploaded', { status: 400 });
        }

        // Parse PDF from Base64
        console.log("Parsing PDF...");
        const base64Data = base64File.split(',')[1]; // Remove data:application/pdf;base64, prefix
        const buffer = Buffer.from(base64Data, 'base64');
        const data = await pdf(buffer);
        const text = data.text;
        console.log("PDF parsed, length:", text.length);

        // Manually convert to core messages to avoid potential issues with convertToCoreMessages
        const coreMessages = messages.map((m: any) => ({
            role: m.role,
            content: m.content,
        }));
        const lastMessage = coreMessages[coreMessages.length - 1];

        if (mode === 'rag') {
            // RAG Logic
            console.log("Starting RAG logic...");
            const splitter = new RecursiveCharacterTextSplitter({
                chunkSize: 1000,
                chunkOverlap: 200,
            });
            const docs = await splitter.createDocuments([text]);
            console.log("Documents split into chunks:", docs.length);

            const embeddings = new GoogleGenerativeAIEmbeddings({
                model: "text-embedding-004",
                taskType: TaskType.RETRIEVAL_DOCUMENT,
                apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
            });

            console.log("Creating vector store...");
            const vectorStore = await SimpleVectorStore.fromDocuments(docs, embeddings);
            console.log("Vector store created");

            // Retrieve relevant chunks
            console.log("Retrieving relevant docs...");
            const relevantDocs = await vectorStore.similaritySearch(lastMessage.content as string, 3);
            console.log("Relevant docs found:", relevantDocs.length);
            const context = relevantDocs.map(d => d.pageContent).join('\n\n');

            const systemPrompt = `You are a helpful assistant. Use the following context to answer the user's question.
      
      Context:
      ${context}`;

            console.log("Streaming text (RAG)...");
            const result = await streamText({
                model: google('gemini-2.5-flash'),
                system: systemPrompt,
                messages: coreMessages,
            });
            console.log("Stream result keys:", Object.keys(result));

            if (typeof (result as any).toDataStreamResponse === 'function') {
                return (result as any).toDataStreamResponse();
            } else if (typeof (result as any).toTextStreamResponse === 'function') {
                console.log("Using toTextStreamResponse");
                return (result as any).toTextStreamResponse();
            } else {
                console.log("Using manual Response with textStream");
                return new Response(result.textStream, {
                    headers: {
                        'Content-Type': 'text/plain; charset=utf-8',
                        'X-Vercel-AI-Data-Stream': 'v1',
                    }
                });
            }

        } else {
            // Full Context Logic
            console.log("Starting Full Context logic...");
            const systemPrompt = `You are a helpful assistant. Use the following document content to answer the user's question.
      
      Document Content:
      ${text}`;

            try {
                console.log("Streaming text (Full Context)...");
                const result = await streamText({
                    model: google('gemini-2.5-flash'),
                    system: systemPrompt,
                    messages: coreMessages,
                });

                if (typeof (result as any).toDataStreamResponse === 'function') {
                    return (result as any).toDataStreamResponse();
                } else if (typeof (result as any).toTextStreamResponse === 'function') {
                    return (result as any).toTextStreamResponse();
                } else {
                    return new Response(result.textStream, {
                        headers: {
                            'Content-Type': 'text/plain; charset=utf-8',
                            'X-Vercel-AI-Data-Stream': 'v1',
                        }
                    });
                }
            } catch (error: any) {
                console.error("Full context error:", error);
                if (error.message?.includes('token') || error.status === 429) {
                    return new Response("Error: Context too large or rate limit exceeded. Please try RAG mode.", { status: 400 });
                }
                throw error;
            }
        }
    } catch (error) {
        console.error("API Error Details:", error);
        return new Response("Internal Server Error", { status: 500 });
    }
}
