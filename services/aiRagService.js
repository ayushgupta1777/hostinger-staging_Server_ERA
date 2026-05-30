import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Concept 2: RAG Pipeline Service
 * In a real large-scale system, this would use a Vector DB to fetch chunks.
 * For this demo, we read a small policy document and return the relevant context
 * based on basic keyword matching, or just return the whole policy if small enough.
 */
export const getStorePolicy = async (topic) => {
    try {
        const policyPath = path.join(__dirname, '../data/ai_store_policy.txt');
        const policyText = fs.readFileSync(policyPath, 'utf8');
        
        // Since the policy is short, we can return the whole thing as context.
        // If we wanted true semantic chunking, we would embed chunks.
        console.log(`[AI RAG] Retrieved store policy for topic: ${topic}`);
        return policyText;
    } catch (error) {
        console.error("[AI RAG Error]", error);
        return "I'm sorry, I couldn't retrieve the store policy at this moment.";
    }
};
