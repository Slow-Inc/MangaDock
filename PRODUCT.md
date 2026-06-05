# Product

## Register

product

## Users

MangaDock serves manga readers who want a fast reading experience, translation users who need text and Patch Translation flows, creators and studio users who manage manga work, and QA testers validating the mobile beta. Mobile users are often returning to continue reading, search, open their library, or verify a beta build on Android.

## Product Purpose

MangaDock combines manga reading, translation, community, and studio workflows in one product. The Hybrid Mobile Shell gives Android users a dedicated app entry point while preserving the existing MangaDock web experience for auth, reader content, library, community, studio, and translation UI. Success means users can enter MangaDock quickly, protected routes keep receiving Mobile Hardware ID signals, and QA can diagnose device-specific failures without turning the mobile app into a full native rewrite.

## Brand Personality

Dark, focused, manga-first, practical.

The product should feel like a serious reading and creator tool: quiet enough for long sessions, dense enough for repeat workflows, and visually aligned with the existing MangaDock web mobile experience.

## Anti-references

Avoid marketing landing pages inside the app, React Native template styling, a separate mobile palette, decorative native screens, full native rewrites of web workflows, duplicated manga feeds, native auth forms, native token storage, and mobile MIT client behavior.

## Design Principles

1. Frontend is the visual source of truth.
2. Native adapts mobile app concerns, it does not duplicate web product workflows.
3. WebView owns MangaDock content, auth, community, studio, and translation UI until a specific native milestone says otherwise.
4. Native surfaces must remain useful when the WebView or deployed domain cannot load.
5. Beta builds should make diagnostics visible; production builds should remove QA friction from reader flow.

## Accessibility & Inclusion

Use product UI conventions that support long reading and repeated actions. Native mobile surfaces should respect safe areas, accessible touch targets, readable contrast, reduced-motion preferences, and clear labels. Diagnostics must mask full Mobile Hardware ID values and avoid exposing secrets or auth tokens.
