import type { CSSProperties } from "react";
import * as React from "react";
import {
  SOCIAL_PREVIEW_AVATAR_URL,
  SOCIAL_PREVIEW_COLORS,
  SOCIAL_PREVIEW_HEIGHT,
  SOCIAL_PREVIEW_WIDTH,
  type SocialPreviewMetadata,
} from "../../data/socialPreview.ts";

const DISPLAY_FONT = "Newsreader, Georgia, serif";
const BODY_FONT = "IBM Plex Sans, Arial, sans-serif";
const MONO_FONT = "IBM Plex Mono, ui-monospace, monospace";

type SocialPreviewCardProps = {
  metadata: SocialPreviewMetadata;
};

function Box({ children, style }: { children?: React.ReactNode; style: CSSProperties }) {
  return React.createElement("div", { style }, children);
}

function Label({ children, style }: { children?: React.ReactNode; style: CSSProperties }) {
  return React.createElement("span", { style }, children);
}

export function SocialPreviewCard({ metadata }: SocialPreviewCardProps) {
  const identityFrame = (
    <Box
      style={{
        display: "flex",
        width: 236,
        height: 236,
        position: "relative",
        alignItems: "center",
        justifyContent: "center",
        border: `1px solid ${SOCIAL_PREVIEW_COLORS.lineStrong}`,
        backgroundColor: SOCIAL_PREVIEW_COLORS.surface,
      }}
    >
      <Box
        style={{
          position: "absolute",
          top: 18,
          left: 18,
          color: SOCIAL_PREVIEW_COLORS.textFaint,
          fontFamily: MONO_FONT,
          fontSize: 12,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
        }}
      >
        SYN / IDENTITY
      </Box>
      <Box
        style={{
          position: "absolute",
          top: 43,
          left: 18,
          width: 44,
          height: 1,
          backgroundColor: SOCIAL_PREVIEW_COLORS.lineStrong,
        }}
      />
      <img
        src={SOCIAL_PREVIEW_AVATAR_URL}
        alt=""
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 44,
          left: 44,
          width: 148,
          height: 148,
          borderRadius: "50%",
          objectFit: "contain",
        }}
      />
      <Box
        style={{
          position: "absolute",
          left: 18,
          right: 18,
          bottom: 42,
          height: 1,
          backgroundColor: SOCIAL_PREVIEW_COLORS.line,
        }}
      />
      <Label
        style={{
          position: "absolute",
          left: 18,
          bottom: 17,
          color: SOCIAL_PREVIEW_COLORS.textFaint,
          fontFamily: MONO_FONT,
          fontSize: 12,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        Operator Syn
      </Label>
      <Box
        style={{
          position: "absolute",
          right: 16,
          bottom: 16,
          width: 10,
          height: 10,
          backgroundColor: SOCIAL_PREVIEW_COLORS.signal,
        }}
      />
    </Box>
  );

  const header = (
    <Box
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
        padding: "18px 28px",
        borderBottom: `1px solid ${SOCIAL_PREVIEW_COLORS.line}`,
        backgroundColor: SOCIAL_PREVIEW_COLORS.surface,
      }}
    >
      <Box
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Box
          style={{
            width: 8,
            height: 8,
            backgroundColor: SOCIAL_PREVIEW_COLORS.signal,
          }}
        />
        <Label
          style={{
            color: SOCIAL_PREVIEW_COLORS.text,
            fontFamily: DISPLAY_FONT,
            fontSize: 24,
            fontWeight: 400,
          }}
        >
          Operator-Syn
        </Label>
        <Label
          style={{
            color: SOCIAL_PREVIEW_COLORS.textFaint,
            fontFamily: MONO_FONT,
            fontSize: 12,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          Working archive
        </Label>
      </Box>
      <Box
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 5,
        }}
      >
        <Label
          style={{
            color: SOCIAL_PREVIEW_COLORS.signal,
            fontFamily: MONO_FONT,
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: "0.1em",
          }}
        >
          {metadata.routeIndex}
        </Label>
        <Label
          style={{
            color: SOCIAL_PREVIEW_COLORS.textFaint,
            fontFamily: MONO_FONT,
            fontSize: 12,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          {metadata.pathname}
        </Label>
      </Box>
    </Box>
  );

  const identityAside = (
    <Box
      style={{
        display: "flex",
        position: "absolute",
        top: 158,
        right: 76,
        width: 260,
        flexDirection: "column",
        justifyContent: "center",
        borderLeft: `1px solid ${SOCIAL_PREVIEW_COLORS.line}`,
        paddingLeft: 28,
      }}
    >
      {identityFrame}
      <Label
        style={{
          marginTop: 14,
          color: SOCIAL_PREVIEW_COLORS.text,
          fontFamily: MONO_FONT,
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        Software developer
      </Label>
      <Label
        style={{
          marginTop: 6,
          color: SOCIAL_PREVIEW_COLORS.textFaint,
          fontFamily: MONO_FONT,
          fontSize: 12,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        Syn-Forge / portfolio
      </Label>
    </Box>
  );

  const main = (
    <Box
      style={{
        display: "flex",
        flex: 1,
        flexBasis: 0,
        gap: 38,
        minHeight: 0,
        position: "relative",
        padding: "28px 38px 26px",
      }}
    >
      <Box
        style={{
          display: "flex",
          width: 700,
          flexShrink: 0,
          flexDirection: "column",
          justifyContent: "center",
          minWidth: 0,
          paddingRight: 4,
        }}
      >
        <Label
          style={{
            color: SOCIAL_PREVIEW_COLORS.signal,
            fontFamily: MONO_FONT,
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          Public archive / {metadata.label}
        </Label>
        <Box
          style={{
            display: "flex",
            maxWidth: 700,
            marginTop: 18,
            color: SOCIAL_PREVIEW_COLORS.text,
            fontFamily: DISPLAY_FONT,
            fontSize: 76,
            fontWeight: 400,
            letterSpacing: "-0.03em",
            lineHeight: 0.92,
            overflowWrap: "break-word",
          }}
        >
          {metadata.title}
        </Box>
        <Box
          style={{
            display: "flex",
            maxWidth: 620,
            marginTop: 18,
            color: SOCIAL_PREVIEW_COLORS.textMuted,
            fontFamily: BODY_FONT,
            fontSize: 22,
            lineHeight: 1.3,
            overflowWrap: "break-word",
          }}
        >
          {metadata.description}
        </Box>
        <Box
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginTop: 24,
          }}
        >
          <Box
            style={{
              width: 42,
              height: 1,
              backgroundColor: SOCIAL_PREVIEW_COLORS.signal,
            }}
          />
          <Label
            style={{
              color: SOCIAL_PREVIEW_COLORS.textFaint,
              fontFamily: MONO_FONT,
              fontSize: 12,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            Syn-Forge / {metadata.label}
          </Label>
        </Box>
      </Box>
    </Box>
  );

  const footer = (
    <Box
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
        padding: "16px 28px",
        borderTop: `1px solid ${SOCIAL_PREVIEW_COLORS.line}`,
        backgroundColor: SOCIAL_PREVIEW_COLORS.surface,
      }}
    >
      <Label
        style={{
          color: SOCIAL_PREVIEW_COLORS.textMuted,
          fontFamily: MONO_FONT,
          fontSize: 13,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        Syn-Forge.com
      </Label>
      <Label
        style={{
          color: SOCIAL_PREVIEW_COLORS.signal,
          fontFamily: MONO_FONT,
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        Open the archive
      </Label>
    </Box>
  );

  return (
    <Box
      style={{
        boxSizing: "border-box",
        display: "flex",
        width: SOCIAL_PREVIEW_WIDTH,
        height: SOCIAL_PREVIEW_HEIGHT,
        flexShrink: 0,
        overflow: "hidden",
        padding: 28,
        backgroundColor: SOCIAL_PREVIEW_COLORS.canvas,
        color: SOCIAL_PREVIEW_COLORS.text,
        fontFamily: BODY_FONT,
      }}
    >
      <Box
        style={{
          display: "flex",
          flex: 1,
          flexDirection: "column",
          position: "relative",
          border: `1px solid ${SOCIAL_PREVIEW_COLORS.line}`,
          backgroundColor: SOCIAL_PREVIEW_COLORS.canvas,
        }}
      >
        <Box
          style={{
            position: "absolute",
            top: -1,
            left: 30,
            width: 72,
            height: 3,
            backgroundColor: SOCIAL_PREVIEW_COLORS.signal,
          }}
        />
        {header}
        {main}
        {footer}
        {identityAside}
      </Box>
    </Box>
  );
}
