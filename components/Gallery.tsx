"use client";

import { motion } from "framer-motion";

// All locally generated nature images in /public/gallery/
const NATURE_IMAGES = [
  { src: "/gallery/mountains.png", title: "Misty Mountains", category: "Mountains", rows: 2 },
  { src: "/gallery/forest.png", title: "Ancient Forest", category: "Forests", rows: 3 },
  { src: "/gallery/desert_dunes.png", title: "Sahara Dunes", category: "Deserts", rows: 2 },
  { src: "/gallery/river.png", title: "Raging River", category: "Rivers", rows: 2 },
  { src: "/gallery/night_sky.png", title: "Milky Way", category: "Night Sky", rows: 3 },
  { src: "/gallery/rainforest.png", title: "Jungle Canopy", category: "Rainforest", rows: 2 },
  { src: "/gallery/lake.png", title: "Glacial Lake", category: "Lakes", rows: 2 },
  { src: "/gallery/snow_peaks.png", title: "Winter Peaks", category: "Snow", rows: 3 },
  { src: "/gallery/foggy_valley.png", title: "Foggy Valley", category: "Valleys", rows: 2 },
  { src: "/gallery/autumn.png", title: "Autumn Forest", category: "Forests", rows: 3 },
  { src: "/gallery/canyon.png", title: "Desert Canyon", category: "Deserts", rows: 2 },
  { src: "/gallery/waterfall.png", title: "Hidden Waterfall", category: "Rivers", rows: 3 },
  { src: "/gallery/glacier.png", title: "Glacier Ice", category: "Snow", rows: 2 },
  { src: "/gallery/desert_flowers.png", title: "Desert Bloom", category: "Deserts", rows: 2 },
  { src: "/gallery/wildlife_plains.png", title: "Elephant Dusk", category: "Plains", rows: 2 },
  { src: "/gallery/ocean.png", title: "Ocean Storm", category: "Oceans", rows: 3 },
  { src: "/gallery/forest_stream.png", title: "Forest Stream", category: "Forests", rows: 2 },
];

const CATEGORY_COLORS: Record<string, string> = {
  Mountains: "text-blue-300   drop-shadow-[0_0_8px_rgba(147,197,253,0.8)]",
  Forests: "text-green-300  drop-shadow-[0_0_8px_rgba(134,239,172,0.8)]",
  Deserts: "text-amber-300  drop-shadow-[0_0_8px_rgba(252,211,77,0.8)]",
  Rivers: "text-cyan-300   drop-shadow-[0_0_8px_rgba(103,232,249,0.8)]",
  "Night Sky": "text-purple-300 drop-shadow-[0_0_8px_rgba(196,181,253,0.8)]",
  Rainforest: "text-emerald-300 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]",
  Lakes: "text-sky-300    drop-shadow-[0_0_8px_rgba(125,211,252,0.8)]",
  Snow: "text-slate-200  drop-shadow-[0_0_8px_rgba(226,232,240,0.8)]",
  Valleys: "text-stone-300  drop-shadow-[0_0_8px_rgba(214,211,209,0.8)]",
  Oceans: "text-teal-300   drop-shadow-[0_0_8px_rgba(94,234,212,0.8)]",
  Plains: "text-orange-300 drop-shadow-[0_0_8px_rgba(253,186,116,0.8)]",
};

export function Gallery() {
  return (
    <section id="gallery" className="w-full bg-[#020503] pt-28 pb-24 px-6 md:px-10 lg:px-16 relative z-20">

      {/* Header */}
      <div className="max-w-7xl mx-auto mb-16 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <div className="inline-flex items-center gap-3 mb-8">
            <div className="h-[1px] w-12 bg-gradient-to-r from-transparent to-green-400/50" />
            <span className="text-green-400/70 font-inter text-[10px] tracking-[0.4em] uppercase font-medium">
              Wild Nature Archive
            </span>
            <div className="h-[1px] w-12 bg-gradient-to-l from-transparent to-green-400/50" />
          </div>
          <h1 className="font-oswald text-5xl sm:text-6xl md:text-7xl lg:text-8xl uppercase font-bold text-white tracking-widest mb-5 leading-none">
            The Archive
          </h1>
          <p className="font-inter text-white/40 text-sm md:text-base max-w-xl mx-auto tracking-wide font-light leading-relaxed">
            Untamed moments frozen in light — from ancient forests to cosmic skies.
          </p>
        </motion.div>
      </div>

      {/* Masonry Grid — CSS multi-column */}
      <div className="max-w-[1600px] mx-auto columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 md:gap-5">
        {NATURE_IMAGES.map((img, i) => (
          <motion.div
            key={i}
            className="relative overflow-hidden rounded-2xl mb-4 md:mb-5 break-inside-avoid group cursor-pointer"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: i * 0.04, ease: "easeOut" }}
          >
            {/* Image */}
            <img
              src={img.src}
              alt={img.title}
              loading="lazy"
              className={`w-full object-cover block transition-transform duration-700 ease-out group-hover:scale-110 
               ${i % 5 === 0 ? "h-[460px]" :
                  i % 4 === 0 ? "h-[320px]" :
                    i % 3 === 0 ? "h-[380px]" :
                      i % 2 === 0 ? "h-[500px]" :
                        "h-[420px]"}
                 `}
            />

            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />

            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-400 pointer-events-none" />

            <div className="absolute bottom-0 left-0 right-0 p-4 md:p-5 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500 ease-out">
              <span className={`font-oswald text-[9px] tracking-[0.3em] uppercase font-medium mb-1 block ${CATEGORY_COLORS[img.category] ?? "text-white/60"}`}>
                {img.category}
              </span>
              <h3 className="text-white font-inter text-sm md:text-base font-semibold tracking-wide drop-shadow-lg">
                {img.title}
              </h3>
            </div>

            <div className="absolute inset-0 rounded-2xl ring-1 ring-white/5 group-hover:ring-white/20 transition-all duration-500 pointer-events-none" />
          </motion.div>
        ))}
      </div>
      <div className="mt-16 text-center">
        <span className="font-inter text-[10px] tracking-[0.4em] uppercase text-white/20">
          — End of Archive —
        </span>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="relative w-full overflow-hidden bg-[#020503] pt-40 pb-16 z-20">
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[160%] md:w-[120%] h-[350px] md:h-[520px] pointer-events-none"
        style={{
          background: "linear-gradient(to bottom, #0a1a10, #010301)",
          borderTopLeftRadius: "50% 100%",
          borderTopRightRadius: "50% 100%",
          boxShadow: "inset 0 20px 90px rgba(52, 211, 153, 0.06)",
        }}
      />

      <div className="relative z-10 flex flex-col items-center pt-16 px-6 text-center">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-green-500/4 blur-[100px] rounded-full pointer-events-none" />


        <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center bg-white/5 backdrop-blur mb-4">
          <span className="text-white font-oswald font-bold text-sm">N</span>
        </div>

        <h4
          className="font-oswald text-2xl md:text-4xl text-white tracking-[0.25em] uppercase font-bold mb-3"
          style={{ textShadow: "0 0 30px rgba(74,222,128,0.25)" }}
        >
          Naturalis
        </h4>

        <p className="font-inter text-xs md:text-sm text-white/40 tracking-wider mb-8 font-light max-w-sm">
          Created by{" "}
          <span className="text-green-300/80 font-medium">Vishakh</span>
          {" "}—{" "}Software Developer
          <span className="mx-2 text-white/20">||</span>
          Frontend Architecture
        </p>

        <div className="flex gap-4 mb-10">
          {[
            {
              label: "GitHub",
              link: "https://github.com/vishakh-cs",
              path: "M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z",
            },
            {
              label: "LinkedIn",
              link: "https://www.linkedin.com/in/vishakh-cs",
              path: "M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z",
            },
          ].map(({ label, path, link }) => (
            <a
              key={label}
              href={link}
              aria-label={label}
              className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center bg-black/40 text-white/50 hover:text-white hover:bg-white/10 hover:border-white/25 transition-all duration-300"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d={path} />
              </svg>
            </a>
          ))}
        </div>

        <div className="h-[1px] w-24 bg-gradient-to-r from-transparent via-white/10 to-transparent mx-auto mb-6" />
        <p className="font-inter text-[10px] tracking-[0.3em] uppercase text-white/20">
          © 2026 Naturalis — All Rights Reserved
        </p>
      </div>
    </footer>
  );
}
