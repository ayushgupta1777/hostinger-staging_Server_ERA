import OpenAI from 'openai';
import { searchProductsSemantically } from '../services/aiVectorService.js';
import { getStorePolicy } from '../services/aiRagService.js';

let openai;
try {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
} catch (e) {
    console.warn("OpenAI API Key not configured.");
}

/**
 * Main AI Assistant Controller
 * Demonstrates Agents (Function Calling), Multimodal (Vision), RAG, and Vector DB.
 */
export const handleAIChat = async (req, res) => {
    try {
        const { message, base64Image } = req.body;

        if (!openai) {
            return res.status(500).json({ success: false, message: "OpenAI API Key is missing. Please configure it in .env." });
        }

        console.log(`[AI Controller] Received message: "${message}" | Image provided: ${!!base64Image}`);

        // 1. Prepare messages for the LLM
        const messages = [
            {
                role: "system",
                content: "You are the 'NEW RAJ FANCY' advanced shopping assistant. You help customers find products and answer questions about store policies. Use your tools to search the catalog or fetch policies."
            }
        ];

        // If multimodal (Concept 4), append image
        if (base64Image) {
            messages.push({
                role: "user",
                content: [
                    { type: "text", text: message || "What is this?" },
                    { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
                ]
            });
        } else {
            messages.push({ role: "user", content: message });
        }

        // 2. Define Agent Tools (Concept 3: Function Calling)
        const tools = [
            {
                type: "function",
                function: {
                    name: "search_catalog",
                    description: "Search the product catalog for items matching a description or visual style.",
                    parameters: {
                        type: "object",
                        properties: {
                            search_query: {
                                type: "string",
                                description: "The semantic search query, e.g. 'red floral dress' or 'silk saree'."
                            }
                        },
                        required: ["search_query"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "get_store_policy",
                    description: "Retrieve store policies regarding returns, shipping, or payments.",
                    parameters: {
                        type: "object",
                        properties: {
                            topic: {
                                type: "string",
                                description: "The policy topic to look up (e.g., 'returns', 'shipping')."
                            }
                        },
                        required: ["topic"]
                    }
                }
            }
        ];

        // 3. Initial LLM Call
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: messages,
            tools: tools,
            tool_choice: "auto"
        });

        let responseMessage = response.choices[0].message;
        let productResults = null;

        // 4. Handle Tool Calls
        if (responseMessage.tool_calls) {
            messages.push(responseMessage); // Append assistant's tool call request

            for (const toolCall of responseMessage.tool_calls) {
                const functionName = toolCall.function.name;
                const args = JSON.parse(toolCall.function.arguments);
                let toolResult = "";

                if (functionName === "search_catalog") {
                    console.log(`[AI Agent] Calling tool: search_catalog with query: "${args.search_query}"`);
                    // Concept 1: Vector Database
                    const products = await searchProductsSemantically(args.search_query);
                    productResults = products; // Save to send back to UI
                    toolResult = JSON.stringify(products);
                } else if (functionName === "get_store_policy") {
                    console.log(`[AI Agent] Calling tool: get_store_policy with topic: "${args.topic}"`);
                    // Concept 2: RAG Pipeline
                    const policyText = await getStorePolicy(args.topic);
                    toolResult = policyText;
                }

                messages.push({
                    tool_call_id: toolCall.id,
                    role: "tool",
                    name: functionName,
                    content: toolResult
                });
            }

            // 5. Final LLM Call to summarize tool results
            const secondResponse = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: messages
            });
            responseMessage = secondResponse.choices[0].message;
        }

        // Return final answer and any recommended products to the UI
        return res.json({
            success: true,
            text: responseMessage.content,
            products: productResults || []
        });

    } catch (error) {
        console.error("[AI Controller Error]", error);
        res.status(500).json({ success: false, message: "Internal server error during AI processing." });
    }
};
