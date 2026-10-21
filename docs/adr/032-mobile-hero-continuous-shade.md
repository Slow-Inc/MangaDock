# ADR 032: Continuous shading over the native discovery cover

Status: Accepted, 2026-10-21

## Context

The Android discovery hero painted its lower 40% with 20 adjacent Views.
Each strip increased black opacity by 0.045, ending at 0.855. The resulting
horizontal boundaries were visible on the Galaxy Z Flip4. This was a discrete
overlay implementation, rather than a defect in the cover image or a CSS shadow.

## Decision

Replace the strips with one View using React Native 0.85.3's existing
`experimental_backgroundImage` linear gradient, from transparent black to
black at 0.855 opacity. Preserve the 40% coverage, clipping, title, sizing,
navigation and pointer-event behavior. No dependency or native module is added.

## Alternatives considered

- More strips: retains discrete boundaries and increases view count.
- A bitmap: adds an asset and scaling concerns for a simple continuous effect.
- An additional gradient package: unnecessary native dependency for this app's
  current React Native version.

## Consequences

The native renderer interpolates the shade continuously and removes 20 child
Views per mounted hero. No runtime speed or memory improvement is quantified.
The React Native property is experimental in the pinned version; check this
screen visually when upgrading React Native. Android device validation is
required; this decision does not establish iOS acceptance. Revert the
`NativeDiscoveryView.tsx` change to restore the old rendering.

Reference: https://reactnative.dev/docs/0.84/view-style-props#experimental_backgroundimage

## Delivery follow-up: tablet sizing

The user made phone/tablet UI verification a publication condition. The old
cover width scaled indefinitely with the viewport, exceeding 1000dp in height
on a typical tablet. Bound width to `min(pageWidth * .88, 320, height * .6 * 2/3)`
while retaining viewport-sized carousel pages. The tested portrait phone keeps
its existing cover dimensions; tablet portrait and landscape both show a
320×480dp cover. See the [delivery evidence](../../Mobile/docs/2026-10-21-discovery-delivery.md).
