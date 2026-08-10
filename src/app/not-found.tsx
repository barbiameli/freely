import Link from "next/link";

/** A page that isn't there, or a quote that has been deleted. Without this,
 * Next's default 404 is an unstyled page with no way back into the app. */
export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <h1 className="font-display italic text-[32px] text-coral m-0">
        There&apos;s nothing here.
      </h1>
      <p className="text-slate text-[14px] mt-2 max-w-[380px]">
        This page may have been deleted, or the link may be wrong.
      </p>
      <Link
        href="/quote"
        className="font-body font-bold text-sm text-white bg-violet rounded-lg px-4 py-2.5 mt-5 no-underline"
      >
        Back to Freely
      </Link>
    </div>
  );
}
