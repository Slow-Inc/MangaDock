interface SectionTitleProps {
    eyebrow?: string;
    title: string;
    subtitle?: string;
    center?: boolean;
}

export default function SectionTitle({ eyebrow, title, subtitle, center = false }: SectionTitleProps) {
    return (
        <div className={`mb-10 ${center ? "text-center" : ""}`}>
            {eyebrow && (
                <p
                    className="text-xs font-semibold uppercase tracking-widest mb-2"
                    style={{ color: "var(--accent)" }}
                >
                    {eyebrow}
                </p>
            )}
            <h2
                className="text-3xl md:text-4xl font-bold leading-tight"
                style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}
            >
                {title}
            </h2>
            {subtitle && (
                <p className="mt-3 text-base max-w-xl" style={{ color: "var(--text-secondary)" }}>
                    {subtitle}
                </p>
            )}
        </div>
    );
}
