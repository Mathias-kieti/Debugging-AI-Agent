import https from 'https';
import { HeuristicFixer } from './heuristicFixer.js';

export class LLMProviderManager {
  constructor(options = {}) {
    this.geminiApiKey = options.geminiApiKey || process.env.GEMINI_API_KEY || null;
    this.openAiApiKey = options.openAiApiKey || process.env.OPENAI_API_KEY || null;
    this.provider = options.provider || (this.geminiApiKey ? 'gemini' : (this.openAiApiKey ? 'openai' : 'heuristic'));
  }

  setProvider(provider, apiKey = null) {
    this.provider = provider;
    if (provider === 'gemini' && apiKey) this.geminiApiKey = apiKey;
    if (provider === 'openai' && apiKey) this.openAiApiKey = apiKey;
  }

  async generateFix(rca, projectRoot) {
    // 1. Try configured LLM provider if API key exists
    if (this.provider === 'gemini' && this.geminiApiKey) {
      try {
        const aiFix = await this.callGemini(rca, projectRoot);
        if (aiFix) return aiFix;
      } catch (err) {
        console.warn('Gemini API call failed, falling back to heuristic engine:', err.message);
      }
    } else if (this.provider === 'openai' && this.openAiApiKey) {
      try {
        const aiFix = await this.callOpenAI(rca, projectRoot);
        if (aiFix) return aiFix;
      } catch (err) {
        console.warn('OpenAI API call failed, falling back to heuristic engine:', err.message);
      }
    }

    // 2. High-precision Deterministic AST / Heuristic Fixer
    const heuristicFix = HeuristicFixer.generateFix(rca, projectRoot);
    if (heuristicFix) {
      return heuristicFix;
    }

    return null;
  }

  async callGemini(rca, projectRoot) {
    const prompt = this.buildPrompt(rca);
    const postData = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json'
      }
    });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.geminiApiKey}`;

    return new Promise((resolve, reject) => {
      const req = https.request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 20000
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) return resolve(null);
            const parsed = JSON.parse(text);
            resolve({
              file: rca.culpritFile,
              originalContent: rca.surroundingContext,
              fixedContent: parsed.fullFixedFileContent,
              description: parsed.explanation,
              appliedVia: 'Gemini 1.5 Flash'
            });
          } catch (e) {
            resolve(null);
          }
        });
      });

      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }

  async callOpenAI(rca, projectRoot) {
    // OpenAI provider implementation
    return null;
  }

  buildPrompt(rca) {
    return `You are DevDebugger AI. Analyze this bug and provide the complete fixed file content.
Error: ${rca.rawMessage}
File: ${rca.culpritFile}
Line: ${rca.culpritLine}
Root Cause: ${rca.rootCause}
Context:
${rca.surroundingContext}

Respond ONLY with a JSON object:
{
  "explanation": "Brief explanation of fix",
  "fullFixedFileContent": "COMPLETE file content with the bug corrected"
}`;
  }
}
