import { GoogleGenAI } from '@google/genai';
import { searchProductsSemantically } from '../services/aiVectorService.js';
import { getStorePolicy } from '../services/aiRagService.js';

let ai;
try {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
} catch (e) {
    console.warn("Gemini API Key not configured.");
}

/**
 * Main AI Assistant Controller
 * Demonstrates Agents (Function Calling), Multimodal (Vision), RAG, and Vector DB.
 */
export const handleAIChat = async (req, res) => {
    try {
        const { message, base64Image } = req.body;

        if (!ai) {
            return res.status(500).json({ success: false, message: "Gemini API Key is missing. Please configure it in .env." });
        }

        console.log(`[AI Controller] Received message: "${message}" | Image provided: ${!!base64Image}`);

        // 1. Prepare contents for Gemini
        const contents = [];

        // If multimodal, append text and image parts
        if (base64Image) {
            contents.push({
                role: "user",
                parts: [
                    { text: message || "What is this?" },
                    {
                        inlineData: {
                            mimeType: "image/jpeg",
                            data: base64Image
                        }
                    }
                ]
            });
        } else {
            contents.push({
                role: "user",
                parts: [{ text: message }]
            });
        }

        // 2. Define Agent Tools (Concept 3: Function Calling)
        const tools = [
            {
                functionDeclarations: [
                    {
                        name: "search_catalog",
                        description: "Search the product catalog for items matching a description or visual style.",
                        parameters: {
                            type: "OBJECT",
                            properties: {
                                search_query: {
                                    type: "STRING",
                                    description: "The semantic search query, e.g. 'red floral dress' or 'silk saree'."
                                }
                            },
                            required: ["search_query"]
                        }
                    },
                    {
                        name: "get_store_policy",
                        description: "Retrieve store policies regarding returns, shipping, or payments.",
                        parameters: {
                            type: "OBJECT",
                            properties: {
                                topic: {
                                    type: "STRING",
                                    description: "The policy topic to look up (e.g., 'returns', 'shipping')."
                                }
                            },
                            required: ["topic"]
                        }
                    }
                ]
            }
        ];

        const systemInstruction = "You are the 'NEW RAJ FANCY' advanced shopping assistant. You help customers find products and answer questions about store policies. Use your tools to search the catalog or fetch policies.";

        // 3. Initial LLM Call
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: contents,
            config: {
                systemInstruction: systemInstruction,
                tools: tools
            }
        });

        let finalResponseText = response.text;
        let productResults = null;

        // 4. Handle Tool Calls
        if (response.functionCalls && response.functionCalls.length > 0) {
            // Append assistant's tool call request to history
            const modelContent = response.candidates[0].content;
            contents.push({
                role: "model",
                parts: modelContent.parts
            });

            const toolParts = [];

            for (const toolCall of response.functionCalls) {
                const functionName = toolCall.name;
                const args = toolCall.args;
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

                toolParts.push({
                    functionResponse: {
                        name: functionName,
                        response: { result: toolResult }
                    }
                });
            }

            // Append tool response to history
            contents.push({
                role: "function",
                parts: toolParts
            });

            // 5. Final LLM Call to summarize tool results
            const secondResponse = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: contents,
                config: {
                    systemInstruction: systemInstruction
                }
            });
            finalResponseText = secondResponse.text;
        }

        // Return final answer and any recommended products to the UI
        return res.json({
            success: true,
            text: finalResponseText,
            products: productResults || []
        });

    } catch (error) {
        console.error("[AI Controller Error]", error);
        res.status(500).json({ success: false, message: "Internal server error during AI processing." });
    }
};

