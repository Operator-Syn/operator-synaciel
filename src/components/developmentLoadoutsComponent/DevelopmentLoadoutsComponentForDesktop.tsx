import "./DevelopmentLoadoutsComponent.css";
import AsyncImage from "../asyncImageLoader/AsyncImage";

interface DevLoadoutSection {
    category: string;
    badges: string[];
}

interface DevLoadoutsContent {
    header: string;
    sections: DevLoadoutSection[];
}

interface DevelopmentLoadoutsComponentForDesktopProps {
    content: DevLoadoutsContent;
}

export default function DevelopmentLoadoutsComponentForDesktop({ content }: DevelopmentLoadoutsComponentForDesktopProps) {
    const { header, sections } = content;

    return (
        <div className="col-4 d-flex flex-column">
            <div className="light-glass-blue-hue flex-grow-1 p-3 rounded shadow-sm">
                <h3 className="mb-3">{header}</h3>
                <hr />
                <div className="dev-accordion-wrapper">
                    <div className="accordion accordion-flush" id="devLoadoutsAccordion">
                        {sections.map((section, index) => (
                            <div className="accordion-item" key={index}>
                                <h2 className="accordion-header" id={`heading${index}`}>
                                    <button
                                        className="accordion-button collapsed py-3 my-0"
                                        type="button"
                                        data-bs-toggle="collapse"
                                        data-bs-target={`#collapse${index}`}
                                        aria-expanded="false"
                                        aria-controls={`collapse${index}`}
                                    >
                                        <p className="m-0">{section.category}</p>
                                    </button>
                                </h2>
                                <div
                                    id={`collapse${index}`}
                                    className="accordion-collapse collapse"
                                    aria-labelledby={`heading${index}`}
                                    data-bs-parent="#devLoadoutsAccordion"
                                >
                                    <div className="accordion-body py-2">
                                        <div
                                            className={`d-flex flex-wrap gap-2 ${section.badges.length > 3
                                                ? "justify-content-between"
                                                : "justify-content-start"
                                                }`}
                                        >
                                            {/* 2. Direct implementation of AsyncImage */}
                                            {section.badges.map((badgeUrl, i) => (
                                                <AsyncImage
                                                    key={i}
                                                    src={badgeUrl}
                                                    alt={`${section.category} badge ${i}`}

                                                    // ADD 'rounded' and 'overflow-hidden' HERE
                                                    wrapperClassName="badge-wrapper rounded overflow-hidden d-inline-flex align-items-center justify-content-center"

                                                    className="badge-img"
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}