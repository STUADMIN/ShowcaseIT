import Link from 'next/link';

/** Left column for split auth layouts (register / unified sign-in). */
export function AuthMarketingAside() {
  return (
    <div className="relative flex flex-col justify-between px-8 py-10 sm:px-10 lg:w-1/2 lg:min-h-screen lg:px-14 lg:py-14 bg-gradient-to-br from-brand-500 via-brand-600 to-brand-800">
      <Link
        href="/"
        className="flex w-fit items-center gap-3 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-600"
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-lg shadow-black/10">
          <span className="text-xl font-black tracking-tight text-brand-600" aria-hidden>
            S
          </span>
        </div>
        <div className="text-left">
          <span className="block text-lg font-bold leading-tight text-white">ShowcaseIt</span>
          <span className="text-xs font-medium text-white/75">Branded User Manuals</span>
        </div>
      </Link>

      <div className="my-10 max-w-lg lg:my-auto">
        <h1 className="text-3xl font-bold leading-[1.15] tracking-tight text-white sm:text-4xl lg:text-[2.65rem] lg:leading-[1.1]">
          Turn recordings into guides, effortlessly.
        </h1>
        <p className="mt-5 text-base leading-relaxed text-white/90 lg:text-lg">
          Join your workspace, capture product walkthroughs, and ship polished manuals your customers and team will
          actually use.
        </p>
      </div>

      <p className="hidden text-sm text-white/50 lg:block">© {new Date().getFullYear()} ShowcaseIt</p>
    </div>
  );
}
