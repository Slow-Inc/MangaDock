import Loader from "./components/ui/Loader";

/** Route-level loading: the server-fetched pages (home, book) showed nothing while they loaded. */
export default function Loading() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <Loader context="page" label="กำลังโหลดหน้า" />
    </div>
  );
}
