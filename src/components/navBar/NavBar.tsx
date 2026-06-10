import { useState, useRef, useEffect, useCallback, type FC } from "react";
import { NavLink } from "react-router-dom";
import Navbar from 'react-bootstrap/Navbar';
import Nav from 'react-bootstrap/Nav';
import Container from 'react-bootstrap/Container';
import "./NavBar.css";

export interface NavLinkItem {
    name: string;
    path: string;
    component?: FC | null;
}

interface NavBarProps {
    brandName: string;
    links: NavLinkItem[];
}

export default function NavBar({ brandName, links }: NavBarProps) {
    const [expanded, setExpanded] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);
    const navRef = useRef<HTMLDivElement>(null);

    const handleClickOutside = useCallback((event: MouseEvent) => {
        if (navRef.current && !navRef.current.contains(event.target as Node)) {
            setExpanded(false);
        }
    }, []);

    useEffect(() => {
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [handleClickOutside]);

    useEffect(() => {
        const handleScroll = () => setIsScrolled(window.scrollY > 12);
        handleScroll();
        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    return (
        <Navbar
            ref={navRef}
            expand="lg"
            expanded={expanded}
            className={`fixed-top glass custom-nav ${isScrolled ? "custom-nav-scrolled" : ""} ${expanded ? "custom-nav-expanded" : ""}`}
        >
            <Container fluid>
                <Navbar.Brand as={NavLink} to="/">
                    {brandName}
                </Navbar.Brand>
                <Navbar.Toggle
                    aria-controls="navbar-nav"
                    aria-label="Toggle navigation"
                    onClick={() => setExpanded((prev) => !prev)}
                />
                <Navbar.Collapse id="navbar-nav">
                    <Nav className="ms-auto">
                        {links.map((link) => (
                            <Nav.Link
                                key={link.path}
                                as={NavLink}
                                to={link.path}
                                onClick={() => setExpanded(false)}
                            >
                                <span className="nav-link-label">{link.name}</span>
                            </Nav.Link>
                        ))}
                    </Nav>
                </Navbar.Collapse>
            </Container>
        </Navbar>
    );
}
