# ADR 033: Anchor Top 10 rankings to cover geometry

Status: Accepted, 2026-10-21

## Context

The native Top 10 horizontal list bottom-aligned entire cards. A two-line title
therefore lifted its cover by one 19dp line relative to a one-line title;
Galaxy Z Flip4 XML measured cover tops at y429 and y372, a 57px difference.
Rank placement also depended on an arbitrary 55dp bottom margin.

## Decision

Top-align ranked cards and place each rank inside a frame matching the cover
height. Derive that frame from the existing 96dp cover width and 2:3 aspect
ratio, so it remains 144dp high regardless of optional metadata or title length.
Keep numeric width intrinsic, including rank 10 and enlarged system text.

## Alternatives and consequences

Fixed total card heights or metadata padding would couple cover alignment to
title/author/category visibility and font scaling. A cover-sized rank frame
keeps those concerns independent. Ordinary rows, cover sizes and navigation
remain unchanged. Text metadata may retain its natural wrapped height.
No dependency is added and no runtime performance improvement is quantified.
Revert only the ranked-layout changes to roll back, keeping the preceding
continuous hero-shade repair.
