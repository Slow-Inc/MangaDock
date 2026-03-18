# R2 and Cloudflare Worker Workflow Sample

## Scope
This document follows the architecture in your diagram and describes the image flow between Frontend, Backend, Cloudflare Worker, R2 Storage, and MIT Server.

Core storage path:
Backend -> Worker -> R2 -> Worker -> Backend

## Components
- Frontend
- Backend
- Worker (Cloudflare)
- R2 Storage (Cloudflare)
- MIT Server (Runpods)

## Main Request Decision
1. Frontend sends Request Image.
2. Frontend evaluates request type:
- Original
- Need Translate

## Flow A: Original Image
1. Frontend sends Original request to Backend.
2. Backend sends Request Original to Worker.
3. Worker sends Request to R2 Storage.
4. R2 Storage returns Image Response to Worker.
5. Worker returns Image to Backend.
6. Backend returns Image to Frontend.

## Flow B: Need Translate
1. Frontend sends Request Translate.
2. Request goes to Worker-side decision: Is has Image.

### B1: Is has Image = YES
1. Worker reads translated image from R2 Storage.
2. R2 Storage returns Image Response to Worker.
3. Worker returns Image to Backend.
4. Backend returns Image to Frontend.

### B2: Is has Image = NO
1. Worker sends processing request to MIT Server (Runpods).
2. MIT Server generates Processed Image.
3. MIT Server stores Processed Image in R2 Storage.
4. Worker requests the new image from R2 Storage.
5. R2 Storage returns Image Response to Worker.
6. Worker returns Image to Backend.
7. Backend returns Image to Frontend.

## End-to-End Sequence Summary
1. User asks Frontend for image.
2. Backend coordinates application-level request handling.
3. Worker is the storage gateway and translation orchestration point.
4. R2 is the persistent image cache and storage layer.
5. MIT Server is used only when translated image is missing.
6. Final image always returns through Worker -> Backend -> Frontend.

## Data Ownership and Responsibility
- Frontend: Request intent only.
- Backend: API control, auth, and response contract.
- Worker: Routing, cache check, storage operations, MIT trigger.
- R2 Storage: Source of stored original and translated assets.
- MIT Server: On-demand translation/processing for cache miss.

## Practical Notes
- Keep translated image keys deterministic so Worker can check existence quickly.
- Treat R2 as cache plus persistence for translated output.
- Use the same response shape from Backend for both Original and Translate flows.
- Log cache hit versus cache miss to monitor MIT usage and cost.

## Final Path Statement
For both Original and Translate requests, the return path to users is consistent:

Worker -> Backend -> Frontend

For storage operations, the core round-trip remains:

Backend -> Worker -> R2 -> Worker -> Backend
