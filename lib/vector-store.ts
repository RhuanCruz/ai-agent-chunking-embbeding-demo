import { Document } from "@langchain/core/documents";
import { Embeddings } from "@langchain/core/embeddings";

interface VectorDocument extends Document {
    embedding: number[];
}

export class SimpleVectorStore {
    documents: VectorDocument[] = [];
    embeddings: Embeddings;

    constructor(embeddings: Embeddings) {
        this.embeddings = embeddings;
    }

    async addDocuments(documents: Document[]) {
        const texts = documents.map((d) => d.pageContent);
        const embeddings = await this.embeddings.embedDocuments(texts);

        this.documents = documents.map((d, i) => ({
            ...d,
            embedding: embeddings[i],
        }));
    }

    async similaritySearch(query: string, k: number = 3): Promise<Document[]> {
        const queryEmbedding = await this.embeddings.embedQuery(query);

        const scoredDocs = this.documents.map((doc) => ({
            doc,
            score: this.cosineSimilarity(queryEmbedding, doc.embedding),
        }));

        scoredDocs.sort((a, b) => b.score - a.score);
        return scoredDocs.slice(0, k).map((sd) => sd.doc);
    }

    private cosineSimilarity(a: number[], b: number[]): number {
        const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
        const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
        const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
        return dotProduct / (magnitudeA * magnitudeB);
    }

    static async fromDocuments(docs: Document[], embeddings: Embeddings): Promise<SimpleVectorStore> {
        const store = new SimpleVectorStore(embeddings);
        await store.addDocuments(docs);
        return store;
    }
}
