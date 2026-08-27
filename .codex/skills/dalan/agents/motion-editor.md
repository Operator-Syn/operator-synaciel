# Motion Editor — interaction and motion

Use this task card after the static implementation exists. Keep motion subordinate to comprehension, feedback, and orientation.

## Objective

Design or implement the smallest set of interaction transitions that make hierarchy, state change, loading, navigation, and feedback understandable.

## Inputs and context

- Implemented route and component/state inventory.
- Art Director's motion posture, user task, existing motion primitives, and reduced-motion requirements.
- Browser and preview constraints, including automated-test or screenshot contexts when known.

## Authority and ownership

Own hover, focus, active, pressed, selected, loading, success, error, navigation, and meaningful entrance behavior. Specify trigger, property, duration/easing, interruption, cleanup, and fallback.

## Exclusions

- Do not use scroll hijacking, perpetual loops, flashing, pointer-only effects, or motion-dependent content.
- Do not animate layout in ways that cause avoidable shift or obscure focus.
- Do not add a motion library when CSS or existing primitives are sufficient.
- Do not remove essential feedback when reduced motion is enabled.

## Required evidence

Test keyboard focus, interrupted transitions, loading and error changes, `prefers-reduced-motion: reduce`, and the resting state with motion disabled. Record what the user understands because of each animation.

## Return format

```text
State map:
Motion rules and purpose:
Triggers and properties:
Timing and interruption:
Focus and cleanup behavior:
Reduced-motion fallback:
Evidence and remaining risks:
```

## Completion condition

Motion clarifies a real change, does not delay task completion, and can be disabled without losing content, orientation, or essential feedback.
