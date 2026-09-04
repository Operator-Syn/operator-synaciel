---
title: Route Interaction Patterns
aliases:
  - Shared interactions
  - Coordinate rail
tags:
  - design-system
  - interaction
  - responsive
role: contract
---

# Route Interaction Patterns

Public routes share a small interaction grammar so the portfolio feels like
one instrument rather than a collection of unrelated page effects. The
current contract is implemented on Home, Projects, Certificates, and Snippets.

## Pointer coordinate rail

[`PointerCoordinates`](../../apps/portfolio-web/src/components/pointerCoordinates/PointerCoordinates.tsx)
is the shared source for the coordinate/status rail. Home uses the
`HomeCoordinates` wrapper with the first marker active; Projects uses the same
component with the second marker active; Certificates uses the third marker;
Snippets uses one marker for the file-index workspace.

The rail:

- reports viewport pointer coordinates for mouse and pen input;
- hands off browser-owned native PDF viewers explicitly: while that surface is hovered, the rail clears X/Y and its registration mark and labels the viewer instead of showing stale coordinates;
- reports `TOUCH` briefly for an active touch contact, then returns to the
  system label;
- moves one registration mark from the actual pointer position using a
  request-animation-frame update, without a trailing overlay or positional
  easing, and re-clamps that mark when the rail resizes;
- accepts a deliberate mouse/pen dwell, touch activation, or keyboard click as
  a bounded signal handshake and announces completion accessibly;
- cancels a touch handshake when the contact moves beyond the existing
  tolerance; and
- keeps the coordinate text and handshake usable when reduced motion is
  enabled.

Use `activeSection` and `markerCount` only for real orientation landmarks. Do
not persist coordinates, marker labels, or generated status copy in the API or
database. If a route has no meaningful section landmarks, use a single marker
rather than inventing a progress system.

## Archive row feedback

Archive rows use a row-sized `::before` surface for hover and `:focus-within`
feedback. It follows the actual row box, including its bottom rule, so the
highlight does not read as a smaller card nested inside the record. The row's
existing padding and grid gaps provide the breathing room for its number, media,
copy, and actions. The number and title use the existing amber signal and a
restrained upward shift, matching Home's selected-work feedback without
changing grid tracks or causing layout shift.

The state must remain understandable through keyboard focus and touch input;
hover is only an additional fine-pointer affordance. Interactive records expose
a full-row click surface around the content for a generous target, while media
controls and explicit project or credential actions remain separate hit areas.
Keep those actions in their existing DOM order.

Certificates use the same full-record feedback contract in a two-column grid
above their content-fit breakpoint. A certificate record keeps its index,
contained media, copy, and credential link together; on narrower frames the
grid becomes one column and then each record stacks into index, media, copy,
and action bands. The credential link uses the existing `alias` cursor state,
while the preview media uses `zoom-in` to open the shared media modal.

The archive shell uses its own inline-size container for the structural
breakpoint. When the available frame is below `1240px`, the action rail moves
below the media and copy instead of overflowing the frame; the existing
`800px` mobile rule then stacks the record into a single readable column. This
keeps the transition tied to the page frame rather than to the browser viewport
alone.

Projects and Certificates use the same cursor-control grammar: the visible
range is derived from the server total and current page size, the next action
uses the opaque `next_cursor`, and the previous action uses the locally
retained cursor history. The controls do not reconstruct offsets or expose
cursor values.

Pagination reserves a right-side clearance for fixed Quick Navigation, so
enabled and disabled controls retain independent hover, cursor, and pointer
targets.

The Projects archive appends a display-only `Still cooking` row after the final
cursor page. It is not stored in D1 and does not participate in the API cursor
or server total; the route adjusts the visible range to include the extra
presentation card without changing real-project pagination.

## Loading and pending states

Loading is a visual state, not a visible word repeated across the interface. Public routes and reusable loading-capable components use the shared loading primitives in
`apps/portfolio-web/src/components/loadingState/LoadingState.tsx` and
`apps/portfolio-web/src/styles/loading-state.css`.

- Preserve the destination geometry with ruled, raised neutral blocks.
- Use a restrained amber signal pulse and glint as the only loading motion.
- Keep stale archive content visible during background refetches; signal pending work beside the existing controls.
- Use format-aware placeholders for media, Markdown, PDF, document metadata, file indexes, and syntax highlighting.
- Keep status announcements available to assistive technology through visually hidden
  `role="status"` content and `aria-busy`; do not expose loading copy in the visual layout.
- Respect `prefers-reduced-motion`: retain the state distinction while removing continuous movement.
- Static custom cursor glyphs remain available for fine pointers when reduced motion is enabled;
  the preference suppresses movement and animation, not pointer affordances.
- Do not change API contracts, route behavior, cursor mappings, or interaction handlers to add loading feedback.

## Route transitions

Top-level navigation uses a signal-curtain transition tied to the four-rail order:
Home, Projects, Certificates, and Snippets. Forward movement carries the curtain
from right to left; backward movement reverses it. Utility pages use a centered
neutral curtain without claiming a rail position.

The curtain is CSS-driven and content-only. It is a fixed surface below the
persistent 4.5rem header, above route content, and below Quick Navigation. It
never enters layout flow or captures pointer input. The amber edge is the
curtain's leading edge, so the accent communicates movement instead of acting as
decoration.

Page transitions run for 560ms: 250ms to cover the content, an 80ms full-cover
handoff, and 230ms to reveal the destination. The cover uses the editorial
easing curve, the handoff holds at full cover, and the reveal uses a symmetric
curtain easing curve so it departs smoothly. Snippet folder changes use the
lighter 220ms workspace transition. Its cue is opacity only; it never translates
the workspace horizontally, changes document width, or adds layout flow. When
reduced motion is active through the visitor setting or operating system
preference, route changes remain immediate and the curtain is omitted; the Motion
setting explains this state. The persistent dock stays above the content curtain
so its controls remain reachable.
Dedicated document routes use the full page transition. Modal, hash, download, canonical-replace, and external-link actions
stay outside this contract.

Each transition receives a keyed active ID so repeated or interrupted
navigations restart cleanly. Older cleanup timers cannot clear a newer intent.
Reduced motion removes the curtain and nested animation while keeping route
changes immediate and usable. Keep route changes non-blocking and do not use the
transition to mask API loading.

Internal route anchors use `TransitionLink` or `TransitionNavLink`, which route
through `usePageNavigate` and mark themselves as managed so the parent capture
boundary does not navigate twice. Quick Navigation closes synchronously before
its transition starts. Unmanaged internal anchors remain covered by the parent
fallback; external, hash, download, modal, and automatic canonicalization links
stay native.

## Snippets archive workspace

The Snippets route uses a persistent two-pane file-index workspace rather than
a modal. The left pane establishes the path and file inventory; the right pane
keeps a bounded preview available for reading without turning the archive into
a full document reader.

- The shared coordinate rail sits between navigation and the workspace.
- Breadcrumbs, the `Index of /snippets/` heading, path, description, and
  NAME/MODIFIED/SIZE columns make the current location explicit.
- Folders navigate to canonical `/snippets/<name>/` paths. The legacy
  `/snippets/root/...` form remains readable and normalizes to the canonical
  route.
- Folder and file records use one keyboard-focusable button spanning the full
  three-column row. Its hover, focus, and selected surface is inset so the
  content keeps deliberate breathing room.
- Selecting a file fetches the tree and bounded preview metadata separately.
- The preview header exposes the format, full path, Download, Close, and
  Read more actions. The archive uses `/api/v2/snippets/:id/preview` for
  Markdown excerpts and reserves complete content for Download or the
  canonical `/snippets/document/<id>/<slug>/` route.
- The preview body has a fixed responsive boundary with its own vertical
  scroll. A long excerpt therefore does not grow the workspace or push the
  index out of view. Empty, loading, and error states remain inside this
  bounded surface.
- Markdown previews retain readable content padding and code-block Copy
  actions. PDF previews use the available preview surface without changing
  the legacy download contract.
- At the `960px` content breakpoint the panes stack vertically. At
  `640px`, row metadata moves below the file name and the preview controls
  stack while preserving hit-area size.
- The shell keeps bottom breathing room for the floating quick-navigation
  control and does not create horizontal overflow on narrow frames.

The dedicated document route is the shareable/indexable full-content surface.
It uses the same Markdown renderer, emits canonical metadata, and normalizes a
stale filename slug back to the current route. The old unversioned snippet
routes remain compatible; v2 is additive. Markdown headers also report a
content-derived read time at 200 words per minute; fenced code and Markdown
syntax do not inflate the estimate. PDFs omit the value because their native
viewer owns the readable content.

See [[design-system/snippets-fidelity|Snippets fidelity]] for the complete
route-specific composition and verification contract.

## Media content modal

The shared `MediaModal` is a media-first project dossier rather than a narrow
editorial text card. On desktop it can grow to a `90rem` ceiling and gives the image or video viewport the largest flexible share of the dialog. The header remains legible without consuming the inspection surface, while the description uses the full remaining text measure below the media.

Image media opens at a complete fit-to-frame view. The integrated viewer then supports:

- wheel zoom with the pointer as the focal point;
- pinch zoom and one-finger drag on touch once the image is enlarged;
- mouse or pen drag while enlarged;
- double-click or double-tap to move between fit and an enlarged inspection view;
- bounded `Zoom in`, `Zoom out`, percentage, and `Reset` controls beside the
  media; and
- `+`, `-`, and `0` keyboard controls for zoom and reset.

Zoom and pan are contained inside the media region with transform-based movement, so the page does not acquire a second scroll surface or lose the image's fit context. The viewer hint and controls recede to a semi-transparent idle state, then return to full contrast on hover, keyboard focus, or active pointer, wheel, touch, and keyboard input without changing their hit areas. Video media keeps its native controls and does not expose image zoom affordances. Gallery changes reset the image view, and Escape, keyboard focus looping, focus restoration, backdrop close, reduced motion, and 44px-class controls remain part of the shared modal contract.

On mobile, the header and label rail compress deliberately but the image stage remains the primary surface. The media toolbar stays reachable without covering the image's focal area, safe-area padding is honored, and touch gestures are enabled only inside image media so ordinary modal controls retain native activation behavior.

## Overlay and disclosure motion

Overlay motion is anchored to the control that opened it: the media modal enters
from the center, the shared floating-control dock unfolds its active panel above
the owning trigger, the mobile navbar descends from the header, and the mobile
document contents panel unfolds above its trigger. Modal entrance/exit uses 280ms/180ms; disclosures use
220ms/160ms. These surfaces use opacity and transforms without entering layout
flow.

Closed persistent panels remain hidden and non-interactive, while the modal stays
mounted until its exit completes so focus restoration and body-scroll locking
remain deterministic. Escape and existing close actions return focus to their
trigger where applicable. Reduced motion removes spatial animation and resolves
the state immediately. The page curtain and media zoom/pan interactions keep
their separate contracts.

## Visitor preferences

The Home-only settings utility, Quick Navigation, and site-wide assistant share
one safe-area-aware floating-control dock. Closed triggers stay horizontal with a
deliberate gap; opening one panel yields the inactive trigger so the active panel
gets the full dock edge and no panel or focus target can cover another. Escape and
close actions restore focus to the trigger, while native browser titles remain the
compact hover labels. Dalan remains
the default palette; Of Times Old is a newly
composed lighter pastel-blue monochrome palette informed by the historical blue
only as reference. Vesper Index is a newly composed rose-led twilight palette
informed by Twilight-5. Switching themes preserves the same content, spacing,
typography, and geometry.
Preferences are browser-local and apply across routes. The reduced-motion
control can add an explicit preference, while turning it off still honors the
operating system's `prefers-reduced-motion` setting.
The assistant panel is viewport-bounded and treats long transcript content as a
layout edge case rather than a second horizontal reading surface. The panel
keeps its header, thread controls, and composer geometry stable while the
transcript owns the single vertical scroll surface. The chat wrapper and message
list stay in normal flow inside that region, so a long message can never be
split by a sticky footer or paint below it. Transcript messages and source links
wrap at any safe break, and the transcript uses the shared neutral scrollbar
treatment without horizontal overflow. At phone widths or short windows
(`max-width: 640px` or `max-height: 560px`), the authenticated assistant opens
as a safe-area-aware full-screen dialog. Its header is compact, the thread
selector and actions stay on one row, and the quota is a closed compact
disclosure so the transcript remains the dominant region. The mobile dialog has
one visible close action and temporarily removes the floating trigger; the
desktop compact and explicitly expanded presentations remain available above
that responsive boundary. The toolbar remains visible above the transcript with
an opaque neutral backing and ruled lower edge; the composer is a fixed-height
footer outside the scroll region, so the next question stays reachable without a
nested scrollbar. The authenticated session is a block-sized containment
surface so the transcript remains bounded through long histories and reconnect
fallbacks. The toolbar and composer paint full-width opaque bands with the
shared surface token, preventing transcript text from bleeding through their
layers. User messages align to the trailing edge with the signal-soft surface;
assistant messages align to the leading edge on a raised neutral surface. On
first load, the transcript moves to the latest message while preserving a
visitor's deliberate scroll position on subsequent updates. While an assistant
response is streaming, markdown updates are coalesced into small visual commits
and a restrained inline caret replaces a repeated card or scroll animation. The
transcript follows only while it is pinned to the bottom; an upward reader
gesture pauses following and exposes a keyboard-accessible **Jump to latest
assistant response** control. The composer uses the scoped
`--assistant-composer-min-block-size` token (`4.75rem` above `400px`, `4.5rem` at
or below `400px`) and lets the textarea grow from its empty/two-row baseline to
an `8rem` cap. Native vertical resizing is disabled; overflow is hidden until
the cap is reached so an empty composer does not expose a scrollbar. Pressing
Enter submits the current question; Shift+Enter inserts a new line, and Enter
during IME composition is left to the composing input method.
When the active transcript has no visible messages, it also offers a small set of
keyboard-accessible starter questions; selecting one submits it through the same
composer path as typed text. If the authenticated archive has no threads, the
frontend provisions one automatically and shows a responsive, non-actionable
placeholder while it is being prepared; it does not offer a duplicate New thread
action in that state. When motion is enabled, opening the panel uses the
overlay-enter token and the FAB, toolbar actions, send action, and composer focus
use short signal-color and pressed-state feedback; all of those effects become
immediate when reduced motion is active.

Destructive thread actions use the reusable `Modal` primitive rather than
`window.alert` or `window.confirm`. The modal renders through a portal, locks
page scrolling, exposes `aria-modal` and a labelled dialog/alertdialog, traps
Tab focus, closes on Escape, and restores focus to the originating trigger.
Connection recovery keeps the panel geometry stable and presents a bounded
reconnection status while the thread remains available.

Automatic context compaction is disabled; the assistant sends the full retained
thread until the model/provider context limit is reached. Legacy context markers
from older threads remain read-only. Empty assistant stream placeholders are
omitted from the transcript; if a stream fails, the panel shows the safe failure
copy and a **Try again** action without disabling a new question.

Workers AI reasoning parts stay separate from answer text. The
normal transcript renders only answer `text` parts; a response with a
`reasoning` part exposes a closed native `Show model reasoning` disclosure for
visitors who deliberately want to inspect it. Thread exports include that
same bounded public reasoning trace for audit, plus sanitized tool-activity
parts and a top-level tool-call index. Arguments, raw MCP payloads, provider
metadata, and credentials remain excluded from the downloadable JSON.
Provider-style `<tool_call>` markers that arrive in conversational answer text
are rendered as bounded, presentation-only tool-call rows rather than raw
markup; they do not invoke a tool. The row shows `Working…` with an accessible
busy state while the answer stream is active and changes to `Recorded` when the
stream closes. Its spinner respects reduced-motion settings.

The built-in themes are Dalan, Of Times Old, Vesper Index, and The Ancient Blue
Ledger. The latter is a permanent light ledger palette; selecting it changes
semantic colors and shadow tints only, preserving the established composition
and interaction contracts.
Theme changes use a 320ms fixed wipe: the existing theme remains visible while
the wipe covers the viewport, the new theme is applied only during the
full-cover 80ms handoff, and the wipe then reveals the updated interface.
The signal-colored edge is visual-only and does not capture pointer or keyboard
input. A newer selection cancels stale frames and cleanup timers so the latest
theme wins. Reduced motion bypasses the wipe and applies the theme immediately.

### Custom theme documents

The Home Settings utility also accepts a versioned local JSON theme document. Visitors can edit or upload a file, receive syntax and field-level validation feedback, and apply it only after the complete document passes validation. A valid document is normalized and stored under the browser's local preference storage; invalid edits leave the currently rendered theme untouched.

The custom editor remains fixed and out of document flow. Its file input, textarea, apply, template, export, and reset controls preserve keyboard focus, accessible announcements, bounded mobile sizing, and the existing settings anchor. Switching to Dalan, Of Times Old, Vesper Index, or The Ancient Blue Ledger clears the custom inline overrides without deleting the saved document. Reset removes the custom document and returns to Dalan.

The document is data-only: JSON is parsed without evaluation, arbitrary CSS properties and CSS text are rejected, and only the documented semantic color and shadow roles can reach `style.setProperty`. Omitted roles inherit Dalan, while valid hexadecimal combinations are not blocked by contrast rules. Shadow geometry stays fixed while custom values control only tint and opacity. Low-contrast combinations are surfaced as optional readability suggestions; they never disable Apply. The custom theme applies to the interface palette only; cursor artwork, media assets, and browser-owned viewers retain their existing behavior.

## Hidden application surfaces

StaticAppPage owns /netbird and /atelier. Both use the same ruled application
shell: coordinate rail, identity-led hero, factual summary grid, and readable
verification bands. The route configs remain the source of application-specific
copy, facts, policy destinations, and metadata.

The 2026-08-26 attachment references are recorded in
[[design-system/references|Portfolio Visual References]]. The old captures show
blue-glass cards and pill actions; the current surface translates that evidence
to the shared cream/amber palette and square ruled controls without changing
security, route, API, or legal behavior. Keep NetBird's private-access meaning
and Atelier's dashboard meaning distinct even though their composition is
shared.

## Adoption checklist

When another public page adopts these patterns:

1. Reuse `PointerCoordinates`; do not copy its pointer listeners or handshake
   timers into a route component.
2. Mount the rail after the shared navigation and before the route's primary
   content band.
3. Choose marker landmarks from the page's actual reading order and keep the
   route modifier responsible only for local spacing or borders.
4. Use the row-sized state surface and the record's internal padding for
   repeated archive/list feedback; do not create a smaller card inside the
   record.
5. Verify mouse, pen, touch, keyboard focus, reduced motion, loading/error/
   empty states, and narrow-width overflow before extending the pattern.

See [[design-system/homepage-fidelity|Homepage fidelity]] for the original
Home motion contract and [[design-system/tokens|Design tokens]] for the shared
motion, color, type, and focus roles.
