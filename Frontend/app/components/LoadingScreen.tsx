/**
 * Full-screen centered spinner shown while a page's auth/data is resolving.
 * Markup is identical to the early-return blocks previously inlined in
 * studio account/wallet/works pages.
 */
export default function LoadingScreen() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#141414]">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
    </div>
  );
}
