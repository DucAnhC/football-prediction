# AGENTS.md

## Project
Football analytics and prediction web app built with Next.js + TypeScript.

## Main Goals
- Show live scores for major football leagues
- Show match statistics and team/player indicators
- Provide AI-assisted match predictions
- Keep code simple, modular, and production-oriented

## Stack
- Next.js (App Router)
- TypeScript
- Tailwind CSS
- ESLint
- Prettier
- Vitest
- React Testing Library

## Product Principles
- Prioritize reliability and clarity over fancy UI
- Data display must be easy to scan
- Prediction output must be structured, not vague
- Avoid overengineering
- Keep pages/components reusable

## Folder Rules
- app/: routes and pages
- components/: reusable UI components
- lib/: helpers, config, api clients, prompts
- services/: server-side business logic
- data/: static json, templates, local knowledge files
- tests/: unit/integration tests
- docs/: product notes, domain docs, football handbook

## Coding Rules
- Use TypeScript strictly
- Prefer server components by default; use client components only when needed
- Keep components small and focused
- Do not create huge files over ~250 lines unless justified
- Do not refactor unrelated code
- Do not rename folders/files unless necessary
- Do not add new packages unless clearly needed

## UI Rules
- Clean, minimal, dashboard-like
- Mobile-first responsive layout
- Tables/cards must remain readable on smaller screens
- Use loading, empty, and error states everywhere data is fetched
- Use Vietnamese text in UI unless the task explicitly asks for English

## Data Rules
- Separate mock data from real API integration
- All external API access must go through a single wrapper layer
- Never hardcode API secrets in source files
- Use `.env.local` for secrets and `.env.example` for required variables
- Prediction logic must distinguish:
  1. raw data
  2. derived indicators
  3. AI explanation
  4. final prediction output

## AI / Prediction Rules
- AI predictions must follow a structured schema
- Never output only one-line “pick” without reasoning
- Always include:
  - match context
  - important indicators
  - risk notes
  - suggested lean / prediction
  - confidence level
- If handbook knowledge exists, use it as guidance rather than treating it as absolute truth
- Do not claim certainty for sports predictions

## Verification Rules
After every coding task, always run:
1. npm run lint
2. npm run test
3. npm run build

If any check fails:
- fix the issue
- rerun the failed command
- continue until all checks pass or clearly report blockers

## Output Format
When finishing a task, always report:
1. Files changed
2. What was implemented
3. Verification results
4. Remaining issues / next steps