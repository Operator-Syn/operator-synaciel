import { ArrowRight, ExternalLink } from "lucide-react";
import type { MediaItem } from "../../../types/MediaCardTypes";
import MediaRenderer from "../../mediaRenderer/MediaRenderer";

interface CertificateArchiveProps {
  certificates: MediaItem[];
  startIndex: number;
  onOpenCertificate: (certificate: MediaItem) => void;
  isInteractive: (certificate: MediaItem) => boolean;
}

function CertificateMedia({
  certificate,
  onOpenCertificate,
  isInteractive,
}: {
  certificate: MediaItem;
  onOpenCertificate: (certificate: MediaItem) => void;
  isInteractive: boolean;
}) {
  const mediaLabel = `${certificate.title} preview`;
  const media = (
    <MediaRenderer
      alt={mediaLabel}
      className="certificate-archive-media-content"
      cursorState={certificate.type === "image" && isInteractive ? "zoom-in" : undefined}
      type={certificate.type}
      url={certificate.url}
    />
  );

  if (certificate.type === "video") {
    return <div className="certificate-archive-media">{media}</div>;
  }

  if (!isInteractive) {
    return <div className="certificate-archive-media">{media}</div>;
  }

  return (
    <button
      aria-label={`Open details for ${certificate.title}`}
      className="certificate-archive-media certificate-archive-media-button"
      data-cursor="zoom-in"
      onClick={() => onOpenCertificate(certificate)}
      type="button"
    >
      {media}
    </button>
  );
}

function CertificateArchiveCard({
  certificate,
  index,
  onOpenCertificate,
  isInteractive,
}: {
  certificate: MediaItem;
  index: number;
  onOpenCertificate: (certificate: MediaItem) => void;
  isInteractive: boolean;
}) {
  const certificateNumber = String(index + 1).padStart(2, "0");
  const titleId = `certificate-archive-title-${certificate.id}`;

  return (
    <article
      aria-labelledby={titleId}
      className="certificate-archive-card"
      onClick={(event) => {
        if (
          !isInteractive ||
          (event.target instanceof Element && event.target.closest("a, button, video"))
        ) {
          return;
        }

        onOpenCertificate(certificate);
      }}
      onKeyDown={(event) => {
        if (
          !isInteractive ||
          (event.target instanceof Element && event.target.closest("a, button, video")) ||
          (event.key !== "Enter" && event.key !== " ")
        ) {
          return;
        }

        event.preventDefault();
        onOpenCertificate(certificate);
      }}
      tabIndex={isInteractive ? 0 : undefined}
    >
      <div className="certificate-archive-index-wrap">
        <p className="certificate-archive-index">{certificateNumber}</p>
      </div>

      <CertificateMedia
        certificate={certificate}
        isInteractive={isInteractive}
        onOpenCertificate={onOpenCertificate}
      />

      <div className="certificate-archive-copy" data-cursor="cell">
        <p className="meta-label">{certificate.type}</p>
        <h2 id={titleId}>{certificate.title}</h2>
        <p className="certificate-archive-description">{certificate.shortDescription}</p>

        <div className="certificate-archive-actions">
          {certificate.projectLink ? (
            <a
              className="certificate-archive-credential-link"
              data-cursor="alias"
              href={certificate.projectLink}
              rel="noopener noreferrer"
              target="_blank"
            >
              <span>View credential</span>
              <ArrowRight aria-hidden="true" size={17} />
              <ExternalLink aria-hidden="true" size={16} />
            </a>
          ) : isInteractive ? (
            <button
              aria-label={`View details for ${certificate.title}`}
              className="certificate-archive-credential-link certificate-archive-credential-button"
              data-cursor="button"
              onClick={() => onOpenCertificate(certificate)}
              type="button"
            >
              <span>View credential</span>
              <ArrowRight aria-hidden="true" size={17} />
            </button>
          ) : (
            <span className="meta-label certificate-archive-unavailable">Credential pending</span>
          )}
        </div>
      </div>
    </article>
  );
}

export default function CertificateArchive({
  certificates,
  startIndex,
  onOpenCertificate,
  isInteractive,
}: CertificateArchiveProps) {
  return (
    <section
      aria-label="Certificate archive"
      className="certificate-archive-grid"
      data-card-count={certificates.length}
    >
      {certificates.map((certificate, index) => (
        <CertificateArchiveCard
          certificate={certificate}
          index={startIndex + index}
          key={certificate.id}
          onOpenCertificate={onOpenCertificate}
          isInteractive={isInteractive(certificate)}
        />
      ))}
    </section>
  );
}
