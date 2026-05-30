import OpenAI from 'openai';
import Product from '../models/Product.js';

let openai;
try {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
} catch (e) {
    console.warn("[AI Vector Service] OpenAI API Key missing, AI features will fail.");
}

// In-memory vector store for demo purposes (avoids needing Atlas Vector Index setup)
let mockVectorStore = null;

// Helper: Cosine Similarity
function cosineSimilarity(vecA, vecB) {
    let dotProduct = 0.0;
    let normA = 0.0;
    let normB = 0.0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Initializes our local mock vector DB by embedding a few real products from the DB.
 */
async function initializeMockVectorStore() {
    if (mockVectorStore) return;
    console.log("[AI Vector Service] Initializing Vector Embeddings...");
    try {
        // Grab the first 10 products from the real DB to use in our vector demo
        const products = await Product.find().limit(10).lean();
        mockVectorStore = [];

        for (const product of products) {
            const textToEmbed = `${product.title} ${product.description || ''} ${product.category?.name || ''}`;
            const response = await openai.embeddings.create({
                model: "text-embedding-3-small",
                input: textToEmbed,
            });
            mockVectorStore.push({
                product,
                embedding: response.data[0].embedding
            });
        }
        console.log(`[AI Vector Service] Embedded ${mockVectorStore.length} products successfully.`);
    } catch (error) {
        console.error("[AI Vector Service Error]", error);
        mockVectorStore = []; // prevent infinite retries
    }
}

/**
 * Concept 1: Vector Database Search
 * Searches for products based on a semantic text query.
 */
export const searchProductsSemantically = async (query) => {
    if (!mockVectorStore) await initializeMockVectorStore();

    try {
        // 1. Embed the query
        const response = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: query,
        });
        const queryEmbedding = response.data[0].embedding;

        // 2. Perform Cosine Similarity Search
        const results = mockVectorStore.map(item => ({
            product: item.product,
            score: cosineSimilarity(queryEmbedding, item.embedding)
        }));

        // Sort by highest similarity
        results.sort((a, b) => b.score - a.score);

        // Return top 3 matches
        const topMatches = results.slice(0, 3).filter(r => r.score > 0.3); // threshold
        
        console.log(`[AI Vector DB] Found ${topMatches.length} semantic matches for: "${query}"`);
        return topMatches.map(match => ({
            id: match.product._id,
            title: match.product.title,
            price: match.product.price,
            image: match.product.images?.[0] || null,
            score: match.score.toFixed(2)
        }));
    } catch (error) {
        console.error("[AI Vector DB Error]", error);
        return [];
    }
};
