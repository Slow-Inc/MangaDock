import Image from "next/image";
import Link from "next/link";

const STARS = [1, 2, 3, 4, 5];

interface BookCardProps {
    title: string;
    author: string;
    genre: string;
    rating: number;
    cover: string;
    slug: string;
}

export default function BookCard({ title, author, genre, rating, cover, slug }: BookCardProps) {
    return (
        <Link href={`/book/${slug}`} className="block group">
            <div
                className="book-card rounded-2xl overflow-hidden smooth-hover"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
            >
                {/* Cover */}
                <div className="relative w-full aspect-[2/3] overflow-hidden">
                    <Image
                        src={cover}
                        alt={title}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        sizes="(max-width: 768px) 50vw, 25vw"
                    />
                    {/* Gradient overlay */}
                    <div
                        className="absolute inset-0"
                        style={{ background: "linear-gradient(to top, rgba(13,15,26,0.85) 0%, transparent 50%)" }}
                    />
                    {/* Genre badge */}
                    <span
                        className="absolute top-3 left-3 text-xs font-semibold px-2.5 py-1 rounded-full"
                        style={{ background: "rgba(245,158,11,0.18)", color: "var(--accent)", border: "1px solid rgba(245,158,11,0.3)" }}
                    >
                        {genre}
                    </span>
                </div>

                {/* Info */}
                <div className="p-4">
                    <h3
                        className="font-semibold text-base leading-snug mb-1 line-clamp-2"
                        style={{ color: "var(--text-primary)" }}
                    >
                        {title}
                    </h3>
                    <p className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>
                        {author}
                    </p>
                    {/* Stars */}
                    <div className="flex items-center gap-0.5">
                        {STARS.map((s) => (
                            <svg
                                key={s}
                                viewBox="0 0 20 20"
                                className="w-3.5 h-3.5"
                                fill={s <= Math.round(rating) ? "var(--accent)" : "none"}
                                stroke="var(--accent)"
                                strokeWidth={1.5}
                            >
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                        ))}
                        <span className="text-xs ml-1.5" style={{ color: "var(--text-secondary)" }}>
                            {rating.toFixed(1)}
                        </span>
                    </div>
                </div>
            </div>
        </Link>
    );
}
