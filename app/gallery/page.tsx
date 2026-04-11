import Link from "next/link";
import { Gallery, Footer } from "@/components/Gallery";

export default function GalleryPage() {
  return (
    <main className="min-h-screen bg-[#020503]">
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-12 py-4">
        <Link href="/" className="flex items-center gap-2 md:gap-3">
          <div className="w-7 h-7 md:w-8 md:h-8 rounded-full border border-white/20 flex items-center justify-center bg-white/5 backdrop-blur-md">
            <span className="text-white text-[10px] md:text-xs font-bold">N</span>
          </div>
          <span className="font-oswald text-white text-sm md:text-lg tracking-[0.2em] md:tracking-[0.3em] uppercase font-bold drop-shadow-lg">
            Naturalis
          </span>
        </Link>

        <Link
          href="/"
          className="flex items-center gap-2 px-3 md:px-5 py-1.5 md:py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md text-white/70 text-[10px] md:text-xs tracking-[0.2em] uppercase font-medium hover:bg-white/10 hover:border-white/25 hover:text-white transition-all duration-300"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span className="hidden sm:inline">Back to Film</span>
        </Link>
      </nav>

      <Gallery />
      <Footer />
    </main>
  );
}
