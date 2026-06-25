import { useState } from "react";
import { Folder, FolderOpen, Home as HomeIcon, ListTree, X } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import "../pages/privacyPolicyPage/PrivacyPolicy.css";
import "./QuickNavigation.css";

type QuickNavigationTab = "portfolio" | "apps";

const visibleRoutePrefixes = ["/projects", "/certificates", "/snippets"];

export default function QuickNavigation() {
    const location = useLocation();
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<QuickNavigationTab>("portfolio");

    const isVisible = location.pathname === "/"
        || visibleRoutePrefixes.some((prefix) => location.pathname.startsWith(prefix));

    if (!isVisible) {
        return null;
    }

    return (
        <div className={`privacy-policy-quick-actions ${isOpen ? "is-open" : ""}`}>
            <div className="privacy-policy-action-panel" aria-hidden={!isOpen}>
                <div className="privacy-policy-action-header">
                    <div>
                        <span>Quick navigation</span>
                        <strong>What do you want to view?</strong>
                    </div>
                    <button
                        aria-label="Close quick navigation"
                        className="privacy-policy-icon-button"
                        onClick={() => setIsOpen(false)}
                        title="Close"
                        type="button"
                    >
                        <X aria-hidden="true" size={18} />
                    </button>
                </div>

                <div className="privacy-policy-action-progress quick-navigation-progress" aria-hidden="true">
                    <span />
                </div>

                <div className="quick-navigation-tabs" role="tablist" aria-label="Quick navigation category">
                    <button
                        aria-controls="quick-navigation-tab-panel"
                        aria-selected={activeTab === "portfolio"}
                        className={`quick-navigation-tab ${activeTab === "portfolio" ? "active" : ""}`}
                        id="quick-navigation-portfolio-tab"
                        onClick={() => setActiveTab("portfolio")}
                        role="tab"
                        type="button"
                    >
                        {activeTab === "portfolio" ? (
                            <FolderOpen aria-hidden="true" size={16} />
                        ) : (
                            <Folder aria-hidden="true" size={16} />
                        )}
                        Portfolio
                    </button>
                    <button
                        aria-controls="quick-navigation-tab-panel"
                        aria-selected={activeTab === "apps"}
                        className={`quick-navigation-tab ${activeTab === "apps" ? "active" : ""}`}
                        id="quick-navigation-apps-tab"
                        onClick={() => setActiveTab("apps")}
                        role="tab"
                        type="button"
                    >
                        {activeTab === "apps" ? (
                            <FolderOpen aria-hidden="true" size={16} />
                        ) : (
                            <Folder aria-hidden="true" size={16} />
                        )}
                        Apps
                    </button>
                </div>

                <div
                    aria-labelledby={activeTab === "portfolio" ? "quick-navigation-portfolio-tab" : "quick-navigation-apps-tab"}
                    className={`quick-navigation-folder-pane ${activeTab === "apps" ? "align-right" : "align-left"}`}
                    id="quick-navigation-tab-panel"
                    role="tabpanel"
                >
                    <nav
                        aria-label={activeTab === "portfolio" ? "Portfolio quick links" : "Syn-Forge app quick links"}
                        className="privacy-policy-action-list quick-navigation-list"
                    >
                        {activeTab === "portfolio" ? (
                            <>
                                <NavLink onClick={() => setIsOpen(false)} to="/projects">
                                    <span>01</span>
                                    Projects
                                </NavLink>
                                <NavLink onClick={() => setIsOpen(false)} to="/certificates">
                                    <span>02</span>
                                    Certificates
                                </NavLink>
                                <NavLink onClick={() => setIsOpen(false)} to="/snippets">
                                    <span>03</span>
                                    Snippets
                                </NavLink>
                                <NavLink onClick={() => setIsOpen(false)} to="/privacy-policy">
                                    <span>04</span>
                                    Privacy
                                </NavLink>
                                <NavLink onClick={() => setIsOpen(false)} to="/terms-and-conditions">
                                    <span>05</span>
                                    Terms
                                </NavLink>
                            </>
                        ) : (
                            <>
                                <NavLink onClick={() => setIsOpen(false)} to="/netbird">
                                    <span>01</span>
                                    NetBird
                                </NavLink>
                                <NavLink onClick={() => setIsOpen(false)} to="/atelier">
                                    <span>02</span>
                                    Atelier
                                </NavLink>
                            </>
                        )}
                    </nav>
                </div>
            </div>

            <button
                aria-expanded={isOpen}
                aria-label="Open quick navigation"
                className="privacy-policy-action-trigger"
                onClick={() => setIsOpen((open) => !open)}
                title="Quick navigation"
                type="button"
            >
                <span className="privacy-policy-action-ring">
                    <span>
                        <HomeIcon aria-hidden="true" size={15} />
                    </span>
                </span>
                <ListTree aria-hidden="true" size={20} />
            </button>
        </div>
    );
}
