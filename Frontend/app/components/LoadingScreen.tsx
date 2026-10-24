/**
 * Full-screen centered spinner shown while a page's auth/data is resolving.
 * Markup is identical to the early-return blocks previously inlined in
 * studio account/wallet/works pages.
 */
import Loader from "./ui/Loader";

export default function LoadingScreen() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg">
      <Loader context="page" />
    </div>
  );
}
