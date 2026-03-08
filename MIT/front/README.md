# MIT Front Utility

This directory contains a standalone browser UI for manually testing the customized manga-image-translator microservice bundled in this repository.

It is a developer and operator tool. It is not the main MetaBooks frontend, and it can also be used by other projects that integrate this microservice.

## Purpose

Use this app when you want to:

- upload an image manually and inspect translation output
- test the streaming endpoint without going through NestJS
- debug rendering or model behavior on a single page
- verify that the MIT service is alive before testing a larger integration flow

## Stack

- React 19
- React Router 7
- Vite 5
- Tailwind CSS 4
- Fetch streaming API

## Prerequisites

Before starting this UI, the MIT service must already be running.

Expected local service URL:

```text
http://localhost:5003
```

Recommended startup order:

1. Start `backend/manga-image-translator/run-server.bat`
2. Wait until the service is ready
3. Start this front-end utility

If the microservice is hosted on another machine, point the front-end proxy at that machine instead of running the service locally.

## Install

```bash
npm install
```

## Run In Development

```bash
npm run dev
```

If the API is not running on the default local address, override the dev proxy target:

```bash
MIT_API_TARGET=http://localhost:5003 npm run dev
```

Example for a remote microservice:

```bash
MIT_API_TARGET=http://10.0.0.25:5003 npm run dev
```

Then open the local URL printed by Vite, typically:

```text
http://localhost:5173
```

## Build

```bash
npm run build
```

## Start Production Build

```bash
npm run start
```

## API Behavior

This UI is wired around the customized MIT service, especially the streaming browser endpoint:

```text
POST /translate/with-form/image/stream/web
```

That endpoint is designed for browser-side progressive UX and is different from the plain full-image endpoint used by the NestJS backend.

## Integration Notes

- If this UI fails immediately, verify the MIT service is reachable on port `5003`.
- If uploads stall on the first request, the worker may still be loading models.
- If translation fails after upload, check `.env` in the MIT service directory, especially Gemini credentials.

## Relationship To Upstream

This tool started from the upstream `manga-image-translator` front-end, but the repo around it has been customized into a reusable microservice setup.

Do not rely on old upstream assumptions such as:

- old upstream default ports or bind addresses
- original repository startup instructions
- generic upstream readme flow

Current default dev proxy target is `http://localhost:5003`.

For the current service setup, use the root README in `backend/manga-image-translator/README.md` as the primary reference.