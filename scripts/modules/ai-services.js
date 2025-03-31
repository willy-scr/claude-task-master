/**
 * ai-services.js
 * AI service interactions for the Task Master CLI
 */

// NOTE/TODO: Menggunakan Gemini API

import { GoogleGenAI } from "@google/genai";
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { CONFIG, log, sanitizePrompt } from './utils.js';
import { startLoadingIndicator, stopLoadingIndicator } from './ui.js';
import chalk from 'chalk';

// Load environment variables
dotenv.config();

// Configure Gemini client
const geminiClient = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// Lazy-loaded Perplexity client
let perplexity = null;

/**
 * Get or initialize the Perplexity client
 * @returns {OpenAI} Perplexity client
 */
function getPerplexityClient() {
  if (!perplexity) {
    if (!process.env.PERPLEXITY_API_KEY) {
      throw new Error("PERPLEXITY_API_KEY environment variable is missing. Set it to use research-backed features.");
    }
    perplexity = new OpenAI({
      apiKey: process.env.PERPLEXITY_API_KEY,
      baseURL: 'https://api.perplexity.ai',
    });
  }
  return perplexity;
}

/**
 * Handle Gemini API errors with user-friendly messages
 * @param {Error} error - The error from Gemini API
 * @returns {string} User-friendly error message
 */
function handleGeminiError(error) {
  // Check if it's a structured error response
  if (error.type === 'error' && error.error) {
    switch (error.error.type) {
      case 'OVERLOADED_ERROR':
        return 'Gemini is currently experiencing high demand and is overloaded. Please wait a few minutes and try again.';
      case 'RATE_LIMIT_ERROR':
        return 'You have exceeded the rate limit. Please wait a few minutes before making more requests.';
      case 'INVALID_REQUEST_ERROR':
        return 'There was an issue with the request format. If this persists, please report it as a bug.';
      default:
        return `Gemini API error: ${error.error.message}`;
    }
  }
  
  // Check for network/timeout errors
  if (error.message?.toLowerCase().includes('timeout')) {
    return 'The request to Gemini timed out. Please try again.';
  }
  if (error.message?.toLowerCase().includes('network')) {
    return 'There was a network error connecting to Gemini. Please check your internet connection and try again.';
  }
  
  // Default error message
  return `Error communicating with Gemini: ${error.message}`;
}

/**
 * Call Gemini to generate tasks from a PRD
 * @param {string} prdContent - PRD content
 * @param {string} prdPath - Path to the PRD file
 * @param {number} numTasks - Number of tasks to generate
 * @param {number} retryCount - Retry count
 * @returns {Object} Gemini's response
 */
async function callGemini(prdContent, prdPath, numTasks, retryCount = 0) {
  try {
    log('info', 'Calling Gemini...');
    
    // Build the system prompt
    const systemPrompt = `You are an AI assistant helping to break down a Product Requirements Document (PRD) into a set of sequential development tasks. 
Your goal is to create ${numTasks} well-structured, actionable development tasks based on the PRD provided.

Each task should follow this JSON structure:
{
  "id": number,
  "title": string,
  "description": string,
  "status": "pending",
  "dependencies": number[] (IDs of tasks this depends on),
  "priority": "high" | "medium" | "low",
  "details": string (implementation details),
  "testStrategy": string (validation approach)
}

Guidelines:
1. Create exactly ${numTasks} tasks, numbered from 1 to ${numTasks}
2. Each task should be atomic and focused on a single responsibility
3. Order tasks logically - consider dependencies and implementation sequence
4. Early tasks should focus on setup, core functionality first, then advanced features
5. Include clear validation/testing approach for each task
6. Set appropriate dependency IDs (a task can only depend on tasks with lower IDs)
7. Assign priority (high/medium/low) based on criticality and dependency order
8. Include detailed implementation guidance in the "details" field

Expected output format:
{
  "tasks": [
    {
      "id": 1,
      "title": "Setup Project Repository",
      "description": "...",
      ...
    },
    ...
  ],
  "metadata": {
    "projectName": "PRD Implementation",
    "totalTasks": ${numTasks},
    "sourceFile": "${prdPath}",
    "generatedAt": "YYYY-MM-DD"
  }
}

Important: Your response must be valid JSON only, with no additional explanation or comments.`;

    // Use streaming for Gemini (OpenAI compatibility mode)
    const model = geminiClient.models.get("gemini-2.0-flash");
    
    // Prepare content with system prompt and user content
    const geminiPrompt = `${systemPrompt}\n\nHere's the Product Requirements Document (PRD) to break down into ${numTasks} tasks:\n\n${prdContent}`;
    
    return await handleStreamingRequest(geminiPrompt, prdPath, numTasks, CONFIG.maxTokens);
  } catch (error) {
    // Get user-friendly error message
    const userMessage = handleGeminiError(error);
    log('error', userMessage);

    // Retry logic for certain errors
    if (retryCount < 2 && (
      error.message?.toLowerCase().includes('overloaded') || 
      error.message?.toLowerCase().includes('rate limit') ||
      error.message?.toLowerCase().includes('timeout') ||
      error.message?.toLowerCase().includes('network')
    )) {
      const waitTime = (retryCount + 1) * 5000; // 5s, then 10s
      log('info', `Waiting ${waitTime/1000} seconds before retry ${retryCount + 1}/2...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return await callGemini(prdContent, prdPath, numTasks, retryCount + 1);
    } else {
      console.error(chalk.red(userMessage));
      if (CONFIG.debug) {
        log('debug', 'Full error:', error);
      }
      throw new Error(userMessage);
    }
  }
}

/**
 * Handle streaming request to Gemini
 * @param {string} prompt - Full prompt
 * @param {string} prdPath - Path to the PRD file
 * @param {number} numTasks - Number of tasks to generate
 * @param {number} maxTokens - Maximum tokens
 * @returns {Object} Gemini's response
 */
async function handleStreamingRequest(prompt, prdPath, numTasks, maxTokens) {
  const loadingIndicator = startLoadingIndicator('Generating tasks from PRD...');
  let responseText = '';
  let streamingInterval = null;
  
  try {
    // Get the model
    const model = geminiClient.models.get("gemini-2.0-flash");
    
    // Use streaming for handling large responses
    const result = await model.generateContentStream({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: CONFIG.temperature
      }
    });
    
    // Update loading indicator to show streaming progress
    let dotCount = 0;
    const readline = await import('readline');
    streamingInterval = setInterval(() => {
      readline.cursorTo(process.stdout, 0);
      process.stdout.write(`Receiving streaming response from Gemini${'.'.repeat(dotCount)}`);
      dotCount = (dotCount + 1) % 4;
    }, 500);
    
    // Process the stream
    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      responseText += chunkText;
    }
    
    if (streamingInterval) clearInterval(streamingInterval);
    stopLoadingIndicator(loadingIndicator);
    
    log('info', "Completed streaming response from Gemini API!");
    
    return processGeminiResponse(responseText, numTasks, 0, prompt, prdPath);
  } catch (error) {
    if (streamingInterval) clearInterval(streamingInterval);
    stopLoadingIndicator(loadingIndicator);
    
    // Get user-friendly error message
    const userMessage = handleGeminiError(error);
    log('error', userMessage);
    console.error(chalk.red(userMessage));
    
    if (CONFIG.debug) {
      log('debug', 'Full error:', error);
    }
    
    throw new Error(userMessage);
  }
}

/**
 * Process Gemini's response
 * @param {string} textContent - Text content from Gemini
 * @param {number} numTasks - Number of tasks
 * @param {number} retryCount - Retry count
 * @param {string} prompt - Original prompt
 * @param {string} prdPath - Path to the PRD file
 * @returns {Object} Processed response
 */
function processGeminiResponse(textContent, numTasks, retryCount, prompt, prdPath) {
  try {
    // Attempt to parse the JSON response
    let jsonStart = textContent.indexOf('{');
    let jsonEnd = textContent.lastIndexOf('}');
    
    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error('No valid JSON found in the response');
    }
    
    const jsonContent = textContent.substring(jsonStart, jsonEnd + 1);
    
    try {
      // Parse and validate the JSON response
      const result = JSON.parse(jsonContent);
      
      // Validate that the response has the correct structure
      if (!result.tasks || !Array.isArray(result.tasks)) {
        throw new Error('Response does not contain a tasks array');
      }
      
      if (result.tasks.length !== numTasks) {
        log('warn', `Expected ${numTasks} tasks, but got ${result.tasks.length}`);
      }
      
      return result;
    } catch (jsonError) {
      log('error', `Error parsing JSON: ${jsonError.message}`);
      
      if (retryCount < 3) {
        log('info', `Retrying JSON parsing with cleanup attempt ${retryCount + 1}/3`);
        
        // Try to clean up the JSON
        const cleanedContent = cleanupJsonResponse(textContent);
        return processGeminiResponse(cleanedContent, numTasks, retryCount + 1, prompt, prdPath);
      } else {
        throw new Error('Failed to parse JSON response after multiple attempts');
      }
    }
  } catch (error) {
    log('error', `Error processing response: ${error.message}`);
    
    if (retryCount < 2) {
      log('info', `Retrying with Gemini to fix the response, attempt ${retryCount + 1}/2`);
      return retryWithGemini(textContent, numTasks, retryCount + 1, prompt, prdPath);
    } else {
      throw new Error(`Failed to process response: ${error.message}`);
    }
  }
}

/**
 * Clean up a JSON response that might have extra content
 * @param {string} content - Content to clean
 * @returns {string} Cleaned content
 */
function cleanupJsonResponse(content) {
  // Try to extract just the JSON part
  let jsonStart = content.indexOf('{');
  let jsonEnd = content.lastIndexOf('}');
  
  if (jsonStart === -1 || jsonEnd === -1) {
    return content; // Can't find JSON markers
  }
  
  return content.substring(jsonStart, jsonEnd + 1);
}

/**
 * Retry with Gemini to fix JSON issues
 * @param {string} problemContent - Content with issues
 * @param {number} numTasks - Number of tasks
 * @param {number} retryCount - Retry count
 * @param {string} originalPrompt - Original prompt
 * @param {string} prdPath - Path to the PRD file
 * @returns {Object} Fixed response
 */
async function retryWithGemini(problemContent, numTasks, retryCount, originalPrompt, prdPath) {
  try {
    log('info', 'Asking Gemini to fix the JSON response...');
    
    const model = geminiClient.models.get("gemini-2.0-flash");
    
    const fixPrompt = `
I received the following response from an AI model, but it's not valid JSON or has structural issues.
Please convert this into valid JSON following exactly this structure:

{
  "tasks": [
    {
      "id": number,
      "title": string,
      "description": string,
      "status": "pending", 
      "dependencies": number[],
      "priority": "high"|"medium"|"low",
      "details": string,
      "testStrategy": string
    },
    ... (exactly ${numTasks} tasks)
  ],
  "metadata": {
    "projectName": "PRD Implementation",
    "totalTasks": ${numTasks},
    "sourceFile": "${prdPath}",
    "generatedAt": "YYYY-MM-DD"
  }
}

Here's the problematic response:
${problemContent}

IMPORTANT: Return ONLY valid JSON with no other text or explanation. Ensure all JSON is properly formatted with the correct syntax.
`;
    
    const result = await model.generateContent({
      contents: [{ parts: [{ text: fixPrompt }] }],
      generationConfig: {
        maxOutputTokens: CONFIG.maxTokens,
        temperature: 0.2 // Lower temperature for more predictable formatting
      }
    });
    
    const fixedContent = result.response.text();
    return processGeminiResponse(fixedContent, numTasks, retryCount, originalPrompt, prdPath);
    
  } catch (error) {
    const userMessage = handleGeminiError(error);
    log('error', userMessage);
    console.error(chalk.red(userMessage));
    throw new Error(`Failed to fix JSON response: ${error.message}`);
  }
}

/**
 * Call Claude to expand task details using research
 * @param {Object} taskData - Task data
 * @param {string} prompt - Additional context prompt
 * @param {number} retryCount - Retry count
 * @returns {string} Expanded task details
 */
async function expandTaskWithResearch(taskData, prompt = "", retryCount = 0) {
  try {
    const perplexityClient = getPerplexityClient();
    const model = CONFIG.perplexityModel || "sonar-medium-online";
    
    log('info', `Researching task "${taskData.title}" with Perplexity AI (model: ${model})...`);
    
    const loadingIndicator = startLoadingIndicator(`Researching task ${taskData.id}: ${taskData.title}...`);
    
    const researchPrompt = `
TASK: ${taskData.title}
DESCRIPTION: ${taskData.description}
${prompt ? `ADDITIONAL CONTEXT: ${prompt}` : ''}

Please research this topic and provide a comprehensive analysis that includes:
1. Current best practices for implementing this type of feature
2. Common implementation approaches
3. Potential libraries, frameworks, or tools that would be useful
4. Security considerations
5. Testing strategies
6. Common pitfalls to avoid

Provide specific, actionable insights that would help a developer implement this task.
`;
    
    const completion = await perplexityClient.chat.completions.create({
      model: model,
      messages: [{ role: "user", content: researchPrompt }],
      temperature: 0.1,
      max_tokens: 4000,
    });
    
    stopLoadingIndicator(loadingIndicator);
    
    const researchResults = completion.choices[0].message.content;
    
    // Now use Gemini to refine the task details based on research
    return await refineTaskWithGemini(taskData, researchResults, prompt);
  } catch (error) {
    log('error', `Error in research: ${error.message}`);
    
    if (retryCount < 2) {
      const waitTime = (retryCount + 1) * 5000;
      log('info', `Waiting ${waitTime/1000} seconds before retry ${retryCount + 1}/2...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return await expandTaskWithResearch(taskData, prompt, retryCount + 1);
    } else {
      // Fall back to Gemini without research
      log('info', 'Falling back to expansion without research...');
      return await expandTaskWithGemini(taskData, prompt);
    }
  }
}

/**
 * Refine task details with Gemini based on research
 * @param {Object} taskData - Task data
 * @param {string} researchResults - Research results
 * @param {string} prompt - Additional context prompt
 * @returns {string} Refined task details
 */
async function refineTaskWithGemini(taskData, researchResults, prompt = "") {
  log('info', `Refining task details for "${taskData.title}" with Gemini based on research...`);
  
  const loadingIndicator = startLoadingIndicator(`Refining task ${taskData.id} with research insights...`);
  
  try {
    const model = geminiClient.models.get("gemini-2.0-flash");
    
    const refinePrompt = `
Based on the following task information and research results, create a detailed implementation plan with the following sections:
1. Approach - Overall strategy for implementing the task
2. Step-by-step implementation plan
3. Key components/files to modify
4. Important considerations (security, performance, etc.)
5. Testing strategy

TASK: ${taskData.title}
DESCRIPTION: ${taskData.description}
${taskData.details ? `EXISTING DETAILS: ${taskData.details}` : ''}
${prompt ? `ADDITIONAL CONTEXT: ${prompt}` : ''}

RESEARCH FINDINGS:
${researchResults}

Format the response as detailed markdown suitable for a developer task breakdown.
Focus on actionable, specific guidance rather than general information.
Include code snippets or examples where appropriate.
`;
    
    const result = await model.generateContent({
      contents: [{ parts: [{ text: refinePrompt }] }],
      generationConfig: {
        maxOutputTokens: 4000,
        temperature: CONFIG.temperature
      }
    });
    
    stopLoadingIndicator(loadingIndicator);
    return result.response.text();
  } catch (error) {
    stopLoadingIndicator(loadingIndicator);
    log('error', `Error refining task: ${error.message}`);
    throw error;
  }
}

/**
 * Expand task details with Gemini
 * @param {Object} taskData - Task data
 * @param {string} prompt - Additional context prompt
 * @param {boolean} isSubtask - Whether it's a subtask
 * @returns {Object} Expanded task details
 */
async function expandTaskWithGemini(taskData, prompt = "", isSubtask = false) {
  log('info', `Expanding task "${taskData.title}" with Gemini...`);
  
  const loadingIndicator = startLoadingIndicator(`Expanding task ${taskData.id}: ${taskData.title}...`);
  
  try {
    const model = geminiClient.models.get("gemini-2.0-flash");
    
    const expandPrompt = `
You are a development task breakdown expert. Create a detailed implementation plan for this task:

TASK: ${taskData.title}
DESCRIPTION: ${taskData.description}
${taskData.details ? `EXISTING DETAILS: ${taskData.details}` : ''}
${prompt ? `ADDITIONAL CONTEXT: ${prompt}` : ''}

Please provide:
1. A detailed implementation approach
2. Step-by-step breakdown of implementation tasks
3. Any specific libraries, tools, or patterns to use
4. Code architecture considerations
5. Potential challenges and solutions
6. A testing strategy to validate the implementation

Format your response as detailed markdown, focusing on practical, actionable guidance.
Include code examples where appropriate.
${isSubtask ? "This is a subtask of a larger task, so keep the implementation focused on this specific component." : ""}
`;
    
    const result = await model.generateContent({
      contents: [{ parts: [{ text: expandPrompt }] }],
      generationConfig: {
        maxOutputTokens: 4000,
        temperature: CONFIG.temperature
      }
    });
    
    stopLoadingIndicator(loadingIndicator);
    return result.response.text();
  } catch (error) {
    stopLoadingIndicator(loadingIndicator);
    const userMessage = handleGeminiError(error);
    log('error', userMessage);
    throw new Error(userMessage);
  }
}

/**
 * Create subtasks for a task with Gemini
 * @param {Object} taskData - Task data
 * @param {number} numSubtasks - Number of subtasks
 * @param {string} prompt - Additional context prompt
 * @param {boolean} useResearch - Whether to use research
 * @returns {Array} Subtasks
 */
async function createSubtasksWithGemini(taskData, numSubtasks, prompt = "", useResearch = false) {
  log('info', `Creating ${numSubtasks} subtasks for task ${taskData.id}: "${taskData.title}"...`);
  
  let researchInsights = "";
  
  // Use research if requested
  if (useResearch) {
    try {
      log('info', 'Gathering research to inform subtask creation...');
      researchInsights = await expandTaskWithResearch(taskData, prompt);
      log('info', 'Research completed successfully');
    } catch (error) {
      log('warn', `Research failed, continuing without it: ${error.message}`);
    }
  }
  
  const loadingIndicator = startLoadingIndicator(`Creating ${numSubtasks} subtasks for task ${taskData.id}...`);
  
  try {
    const model = geminiClient.models.get("gemini-2.0-flash");
    
    const subtaskPrompt = `
You are an expert at breaking down development tasks into subtasks. Given this parent task:

TASK ID: ${taskData.id}
TITLE: ${taskData.title}
DESCRIPTION: ${taskData.description}
DETAILS: ${taskData.details || "Not provided"}
${prompt ? `ADDITIONAL CONTEXT: ${prompt}` : ''}
${researchInsights ? `RESEARCH: ${researchInsights}` : ''}

Create ${numSubtasks} subtasks that together would accomplish this parent task. Each subtask should:
1. Be focused on a single, clear responsibility
2. Include implementation details
3. Include a test/validation strategy
4. Build in a logical sequence (later subtasks may depend on earlier ones)

Return these subtasks in a valid JSON array with this structure:
[
  {
    "id": "${taskData.id}.1",
    "title": "Subtask title",
    "description": "Brief description",
    "status": "pending",
    "dependencies": [], 
    "priority": "high",
    "details": "Detailed implementation guidance",
    "testStrategy": "How to verify this subtask"
  },
  ...
]

Important:
- All subtask IDs must be in the format "${taskData.id}.[1-${numSubtasks}]"
- Return exactly ${numSubtasks} subtasks
- Dependencies should be IDs of other subtasks in this array that must be completed first
- Return ONLY valid JSON without any additional text or explanation
- Make sure each subtask has complete details that could stand alone as a task
`;
    
    const result = await model.generateContent({
      contents: [{ parts: [{ text: subtaskPrompt }] }],
      generationConfig: {
        maxOutputTokens: 8000,
        temperature: CONFIG.temperature
      }
    });
    
    stopLoadingIndicator(loadingIndicator);
    
    // Process the response
    let subtasksJson;
    try {
      const response = result.response.text();
      
      // Extract JSON if wrapped in markdown or other text
      const jsonMatch = response.match(/```(?:json)?\s*(\[\s*\{.*\}\s*\])\s*```/s) || 
                         response.match(/(\[\s*\{.*\}\s*\])/s);
      
      const jsonText = jsonMatch ? jsonMatch[1] : response;
      subtasksJson = JSON.parse(jsonText);
      
      // Validate subtasks
      if (!Array.isArray(subtasksJson)) {
        throw new Error('Response is not an array');
      }
      
      if (subtasksJson.length !== numSubtasks) {
        log('warn', `Expected ${numSubtasks} subtasks, but got ${subtasksJson.length}`);
      }
      
      // Ensure IDs are in the correct format
      subtasksJson = subtasksJson.map((subtask, index) => {
        return {
          ...subtask,
          id: `${taskData.id}.${index + 1}`
        };
      });
      
      return subtasksJson;
    } catch (error) {
      log('error', `Error parsing subtasks JSON: ${error.message}`);
      
      // Try to fix the JSON with a second Gemini call
      return await fixSubtasksJson(result.response.text(), taskData.id, numSubtasks);
    }
  } catch (error) {
    stopLoadingIndicator(loadingIndicator);
    const userMessage = handleGeminiError(error);
    log('error', userMessage);
    throw new Error(userMessage);
  }
}

/**
 * Fix JSON for subtasks
 * @param {string} problematicJson - Problematic JSON string
 * @param {number|string} parentTaskId - Parent task ID
 * @param {number} numSubtasks - Number of subtasks
 * @returns {Array} Fixed subtasks
 */
async function fixSubtasksJson(problematicJson, parentTaskId, numSubtasks) {
  log('info', 'Attempting to fix malformed subtasks JSON...');
  
  try {
    const model = geminiClient.models.get("gemini-2.0-flash");
    
    const fixPrompt = `
I received the following response that should be a JSON array of ${numSubtasks} subtasks, but it has formatting issues.
Please fix it and return a valid JSON array.

The subtasks should follow this exact structure:
[
  {
    "id": "${parentTaskId}.1",
    "title": "Subtask title",
    "description": "Description",
    "status": "pending",
    "dependencies": [],
    "priority": "high"|"medium"|"low",
    "details": "Implementation details",
    "testStrategy": "Verification approach"
  },
  ...
]

Here's the problematic JSON:
${problematicJson}

IMPORTANT: 
- Return ONLY the valid JSON array with no other text
- Ensure there are exactly ${numSubtasks} subtasks
- Make sure all IDs are in the format "${parentTaskId}.[1-${numSubtasks}]"
- Every subtask must have all required fields
`;
    
    const result = await model.generateContent({
      contents: [{ parts: [{ text: fixPrompt }] }],
      generationConfig: {
        maxOutputTokens: 8000,
        temperature: 0.2
      }
    });
    
    // Process the fixed response
    try {
      const response = result.response.text();
      
      // Extract JSON if wrapped in markdown or other text
      const jsonMatch = response.match(/```(?:json)?\s*(\[\s*\{.*\}\s*\])\s*```/s) || 
                         response.match(/(\[\s*\{.*\}\s*\])/s);
      
      const jsonText = jsonMatch ? jsonMatch[1] : response;
      const subtasksJson = JSON.parse(jsonText);
      
      // Validate subtasks
      if (!Array.isArray(subtasksJson)) {
        throw new Error('Fixed response is not an array');
      }
      
      // Ensure IDs are in the correct format
      return subtasksJson.map((subtask, index) => {
        return {
          ...subtask,
          id: `${parentTaskId}.${index + 1}`
        };
      });
    } catch (error) {
      log('error', `Error parsing fixed subtasks JSON: ${error.message}`);
      throw new Error('Failed to fix subtasks JSON after retry');
    }
  } catch (error) {
    const userMessage = handleGeminiError(error);
    log('error', userMessage);
    throw new Error(userMessage);
  }
}

/**
 * Analyze task complexity with Gemini
 * @param {Object} taskData - Task data
 * @param {boolean} useResearch - Whether to use research
 * @returns {Object} Complexity analysis
 */
async function analyzeTaskComplexity(taskData, useResearch = false) {
  log('info', `Analyzing complexity of task ${taskData.id}: "${taskData.title}"...`);
  
  let researchInsights = "";
  
  // Use research if requested
  if (useResearch) {
    try {
      log('info', 'Gathering research to inform complexity analysis...');
      researchInsights = await expandTaskWithResearch(taskData, "");
      log('info', 'Research completed successfully');
    } catch (error) {
      log('warn', `Research failed, continuing without it: ${error.message}`);
    }
  }
  
  const loadingIndicator = startLoadingIndicator(`Analyzing complexity of task ${taskData.id}...`);
  
  try {
    const model = geminiClient.models.get("gemini-2.0-flash");
    
    const complexityPrompt = `
You are an expert at estimating development task complexity. Analyze this task:

TASK ID: ${taskData.id}
TITLE: ${taskData.title}
DESCRIPTION: ${taskData.description}
DETAILS: ${taskData.details || "Not provided"}
${researchInsights ? `RESEARCH: ${researchInsights}` : ''}

Provide a detailed complexity analysis in JSON format:
{
  "complexityScore": 1-10 integer (1=trivial, 10=extremely complex),
  "analysis": "Detailed explanation of the complexity factors",
  "timeEstimate": "Estimated time to complete (hours/days)",
  "recommendedSubtasks": 2-10 integer (recommended number of subtasks),
  "subtaskRecommendation": "Explanation of how to break down the task",
  "riskFactors": ["List", "of", "potential", "risks"],
  "recommendedApproach": "Suggested implementation approach",
  "expansionPrompt": "Tailored prompt for expanding this task into subtasks"
}

IMPORTANT: Return ONLY valid JSON with no additional text or explanation.
Base your complexity score on these factors:
1. Technical complexity
2. Scope and breadth
3. Dependencies and integrations
4. Risk factors
5. Required expertise

The complexity score scale:
1-2: Trivial, straightforward tasks (minutes to hours)
3-4: Simple tasks with clear solutions (hours to a day)
5-6: Moderate complexity, some planning needed (1-2 days)
7-8: Complex tasks requiring careful design (2-5 days)
9-10: Highly complex, significant planning required (5+ days)
`;
    
    const result = await model.generateContent({
      contents: [{ parts: [{ text: complexityPrompt }] }],
      generationConfig: {
        maxOutputTokens: 4000,
        temperature: 0.2
      }
    });
    
    stopLoadingIndicator(loadingIndicator);
    
    // Process the response
    try {
      const response = result.response.text();
      
      // Extract JSON if wrapped in markdown or other text
      const jsonMatch = response.match(/```(?:json)?\s*(\{.*\})\s*```/s) || 
                         response.match(/(\{.*\})/s);
      
      const jsonText = jsonMatch ? jsonMatch[1] : response;
      const complexityData = JSON.parse(jsonText);
      
      return {
        taskId: taskData.id,
        ...complexityData
      };
    } catch (error) {
      log('error', `Error parsing complexity JSON: ${error.message}`);
      throw new Error('Failed to parse complexity analysis');
    }
  } catch (error) {
    stopLoadingIndicator(loadingIndicator);
    const userMessage = handleGeminiError(error);
    log('error', userMessage);
    throw new Error(userMessage);
  }
}

// Export the functions
export {
  callGemini,
  expandTaskWithGemini,
  expandTaskWithResearch,
  createSubtasksWithGemini,
  analyzeTaskComplexity,
  geminiClient
}; 