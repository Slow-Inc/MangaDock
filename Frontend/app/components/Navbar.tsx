"use client";

import Link from "next/link";
import { useState } from "react";

const navLinks = [
    { label: "หน้าหลัก", href: "/" },
    { label: "เรียกดู", href: "/browse" },
    { label: "ขายดี", href: "/bestsellers" },
    { label: "เกี่ยวกับ", href: "/about" },
];

export default function Navbar() {
    const [open, setOpen] = useState(false);
    const oauthBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

    return (
        <header
            style={{ background: "rgba(5, 8, 18, 0.84)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}
            className="fixed top-0 left-0 right-0 z-50 backdrop-blur-lg"
        >
            <div className="mx-auto max-w-7xl px-6 flex items-center justify-between h-16">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-2 group">
                    <span
                        style={{ fontFamily: "var(--font-playfair)", fontSize: "1.4rem", fontWeight: 700 }}
                        className="gradient-text"
                    >
                        Meta<span style={{ WebkitTextFillColor: "var(--text-primary)" }}>Books</span>
                    </span>
                </Link>

                {/* Desktop nav */}
                <nav className="hidden md:flex items-center gap-8">
                    {navLinks.map((l) => (
                        <Link
                            key={l.href}
                            href={l.href}
                            style={{ color: "var(--text-secondary)", fontSize: "0.92rem", fontWeight: 500 }}
                            className="transition-colors hover:text-white"
                        >
                            {l.label}
                        </Link>
                    ))}
                </nav>

                {/* CTA */}
                <div className="hidden md:flex items-center gap-3">
                    <a href={`${oauthBaseUrl}/auth/google`} className="btn-ghost px-4 py-2 text-sm">
                        Google
                    </a>
                    <a href={`${oauthBaseUrl}/auth/facebook`} className="btn-primary px-4 py-2 text-sm">
                        Facebook
                    </a>
                </div>

                {/* Mobile hamburger */}
                <button
                    onClick={() => setOpen(!open)}
                    className="md:hidden flex flex-col gap-1.5 p-2"
                    aria-label="เมนู"
                >
                    {[0, 1, 2].map((i) => (
                        <span
                            key={i}
                            style={{ background: "var(--text-primary)", display: "block", width: 22, height: 2, borderRadius: 2 }}
                        />
                    ))}
                </button>
            </div>

            {/* Mobile menu */}
            {open && (
                <div
                    style={{ background: "var(--bg-card)", borderTop: "1px solid var(--border)" }}
                    className="md:hidden px-6 py-4 flex flex-col gap-4"
                >
                    {navLinks.map((l) => (
                        <Link
                            key={l.href}
                            href={l.href}
                            style={{ color: "var(--text-secondary)" }}
                            className="hover:text-white transition-colors text-sm font-medium"
                            onClick={() => setOpen(false)}
                        >
                            {l.label}
                        </Link>
                    ))}
                    <a href={`${oauthBaseUrl}/auth/google`} className="btn-ghost px-5 py-2 text-sm text-center mt-2">
                        เข้าสู่ระบบด้วย Google
                    </a>
                    <a href={`${oauthBaseUrl}/auth/facebook`} className="btn-primary px-5 py-2 text-sm text-center">
                        เข้าสู่ระบบด้วย Facebook
                    </a>
                </div>
            )}
        </header>
    );
}
