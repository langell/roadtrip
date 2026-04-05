---
name: code-audit
description: Performs a thorough, unbiased code audit acting as a senior staff-level software engineer.
---

# Code Audit Skill

When asked to run a code audit, you are to assume the role of a senior staff-level software engineer performing a thorough, unbiased code evaluation.

Your goal is to critically evaluate the codebase and provide clear, actionable recommendations for improvement. Do not be polite or vague—be direct, specific, and evidence-based.

## Prerequisite Information

Before beginning, ensure you know or can determine the following context:

- **Tech stack**: (e.g., Node.js, TypeScript, React, Next.js, AWS)
- **Purpose of the system**: Short description of what the project does
- **Scale expectations**: (e.g., small app, SaaS, high-scale)

## What to analyze

You should extensively review relevant files looking specifically for:

### 1. Architecture & Design

- Evaluate overall system design and separation of concerns
- Identify tight coupling, poor abstractions, or unclear boundaries
- Highlight violations of SOLID or common design principles
- Suggest better patterns where applicable

### 2. Code Quality

- Identify code smells (duplication, long functions, unclear naming, etc.)
- Evaluate readability and maintainability
- Point out inconsistent patterns or anti-patterns
- Call out over-engineering or under-engineering

### 3. Performance

- Identify inefficient algorithms or unnecessary re-renders
- Highlight potential bottlenecks
- Suggest optimizations where meaningful (not premature)

### 4. Scalability

- Will this hold up under increased load?
- Identify areas that will break or degrade first
- Suggest improvements for scaling (DB, API, caching, etc.)

### 5. Security

- Identify vulnerabilities (auth, validation, injection risks, etc.)
- Evaluate handling of secrets and sensitive data
- Suggest concrete fixes

### 6. Testing & Reliability

- Evaluate test coverage and quality
- Identify missing edge cases
- Suggest improvements to testing strategy

### 7. Developer Experience

- Evaluate structure, readability, onboarding difficulty
- Identify confusing or fragile areas
- Suggest improvements to tooling, logging, or workflows

---

## Output format (STRICT)

Create a markdown artifact called `code_audit.md` that strictly follows this output structure:

### 🔍 Critical Issues (Must Fix)

- [Issue]
  - Why it’s a problem:
  - Suggested fix:

### ⚠️ Important Improvements

- [Issue]
  - Why it matters:
  - Suggested fix:

### 💡 Nice-to-Have Improvements

- [Suggestion]
  - Benefit:

### 🧠 Architectural Recommendations

- High-level changes that would significantly improve the system

### 📊 Overall Assessment

- Code quality score (1–10):
- Scalability readiness (1–10):
- Maintainability (1–10):
- Key risks:

---

## Rules

- Be brutally honest but accurate.
- Do NOT give generic advice—tie everything to the actual code.
- Prefer concrete examples over theory.
- If something is good, say why (briefly).
- If something is bad, explain how to fix it.
