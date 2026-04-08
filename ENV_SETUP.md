# Environment Setup

Create a `.env.local` file in the project root (`student-scheduler/.env.local`).

## Default: Gemini (recommended)

```
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.1-flash-lite
```

1. Open [Google AI Studio](https://makersuite.google.com/app/apikey)  
2. Create an API key  
3. Paste into `.env.local` and restart `npm run dev`

Optional: add Groq as fallback or override:

```
GROQ_API_KEY=gsk_your_key_here
GROQ_MODEL=llama-3.3-70b-versatile
```

## Provider override (optional)

If you want to force a provider order:

```
AI_PROVIDER=gemini   # Gemini first
# or
AI_PROVIDER=groq     # Groq first
```

## Important notes

- Never commit `.env.local` to version control  
- Keys are used **server-side** only (`app/api/gemini/route.ts` — unified AI route)  
- With no `AI_PROVIDER`, the app uses **Gemini first** and **Groq fallback** (when both keys are configured).
