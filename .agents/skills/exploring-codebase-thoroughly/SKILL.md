---
name: exploring-codebase-thoroughly
description: Use when exploring a new or complex codebase, onboarding onto a repository, or planning tasks that require understanding dependencies beyond immediate files.
---

# Exploring Codebase Thoroughly

## Overview
Shallow codebase scanning leads to brittle plans, broken dependencies, and architectural drift. To truly understand a project, you must inspect the system end-to-end, trace data flows across stack boundaries, and inspect high-signal config files. Do not assume local context is sufficient.

## When to Use
* Beginning a new task or issue in a multi-component repository.
* Planning architectural changes, refactorings, or migrations.
* Investigating complex bugs with unknown root causes.

## Core Rules for Exploration
1. **Never limit inspection to 4-5 files**: If a repository has multiple stack layers (e.g., Frontend, Backend, ML Worker), you must read files in *each* relevant layer to understand the integration.
2. **Follow the Data Flow**: Trace requests from the Frontend UI -> Next.js Proxy -> Backend Controller -> Service -> Cache/Database -> ML worker.
3. **Inspect the Configs First**: Always read `package.json`, `tsconfig.json`, `pyproject.toml`, or `.env` files to know the exact versions, builds, and settings.
4. **Search and Verify**: Do not guess if a utility function exists. Use grep/find tools to search the codebase.

## Rationalization Table

| Excuse | Reality |
|---|---|
| "I already read the target file, it's a simple change." | Even simple changes can have far-reaching effects on caching, database schemas, or API contracts. |
| "I read the README and DESIGN.md, I understand it." | Documentation can be outdated. The codebase is the single source of truth. |
| "Reading 5 files is enough for this scope." | 5 files only show local scope. You are missing hidden dependencies, decorators, and interceptors. |

## Red Flags - STOP and Read More Files
* You have read fewer than 8 files in a multi-layer codebase.
* You are making assumptions about database fields or API responses without viewing the schema/DTO files.
* You are starting to write code before exploring where else the changed components are imported.
