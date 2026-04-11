"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

// Fallback high-quality Unsplash nature images (all use unique IDs)
const NATURE_IMAGES = [
  { id: "eOOweG-YpXg", height: 400, title: "Misty Mountains", category: "Mountains" },
  { id: "1527pjeb6jg", height: 550, title: "Deep Forest", category: "Forests" },
  { id: "M9F8VR0jEPM", height: 380, title: "Sahara Dunes", category: "Deserts" },
  { id: "cssvEZacHvQ", height: 450, title: "Raging River", category: "Rivers" },
  { id: "Nn5rX-jE0E0", height: 600, title: "Starry Night", category: "Night Sky" },
  { id: "lA7Doz_Rup0", height: 420, title: "Jungle Canopy", category: "Rainforest" },
  { id: "W5uK9hO62I0", height: 500, title: "Quiet Lake", category: "Lakes" },
  { id: "Q1p7bh3SHj8", height: 350, title: "Winter Peaks", category: "Snow" },
  { id: "o4mP1EibX38", height: 480, title: "Foggy Valley", category: "Mountains" },
  { id: "T7K4aEPoGGk", height: 600, title: "Autumn Leaves", category: "Forests" },
  { id: "F8t2VGwe1Hw", height: 400, title: "Canyon Edge", category: "Deserts" },
  { id: "nBuiLbz_j4A", height: 550, title: "Hidden Waterfall", category: "Rivers" },
  { id: "VwQkEYB3yK0", height: 480, title: "Milky Way", category: "Night Sky" },
  { id: "7rA1o4Q00qM", height: 380, title: "Tropical Path", category: "Rainforest" },
  { id: "Hcfwew744z4", height: 450, title: "Glacier Ice", category: "Snow" },
  { id: "xVptEzm4-nU", height: 520, title: "Desert Bloom", category: "Deserts" },
  { id: "JgOeRqOOvXo", height: 400, title: "Morning Dew", category: "Forests" },
  { id: "P2aOvMMUNxE", height: 480, title: "Wildlife Plains", category: "Plains" },
  { id: "Qz6zxqXPNzk", height: 350, title: "Ocean Waves", category: "Oceans" },
  { id: "EwKXn5PhPC0", height: 550, title: "Forest Stream", category: "Rivers" },
];

export function Gallery() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return (
    <section id="gallery" className="w-full bg-[#020503] pt-24 pb-32 px-6 md:px-12 relative z-20">
      {/* Gallery Header */}
      <div className="max-w-7xl mx-auto mb-16 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
        >
          <div className="w-16 h-[2px] bg-accent-green mx-auto mb-6 opacity-60" />
          <h2 className="font-oswald text-5xl md:text-7xl uppercase font-bold text-white tracking-widest mb-4 drop-shadow-xl">
            The Archive
          </h2>
          <p className="font-inter text-white/50 text-base md:text-lg max-w-2xl mx-auto tracking-wide font-light">
            A curated collection of untamed moments frozen in time.
          </p>
        </motion.div>
      </div>

      {/* Masonry Grid Setup using CSS multi-columns */}
      <div className="max-w-[1400px] mx-auto columns-1 sm:columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-4 md:gap-6 space-y-4 md:space-y-6">
        {isClient && NATURE_IMAGES.map((img, i) => (
          <motion.div
            key={i}
            className="relative overflow-hidden rounded-2xl group break-inside-avoid shadow-[0_4px_30px_rgba(0,0,0,0.5)] transform-gpu"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "100px" }}
            transition={{ duration: 0.6, delay: (i % 5) * 0.1, ease: "easeOut" }}
          >
            {/* Lazy Image */}
            <img
              src={`https://images.unsplash.com/photo-${img.id}?q=80&w=600&auto=format&fit=crop`}
              alt={img.title}
              loading="lazy"
              className="w-full object-cover transition-transform duration-1000 group-hover:scale-110"
              style={{ minHeight: `${img.height / 2}px` }}
            />
            
            {/* Hover Gradient & Text Glow Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none flex flex-col justify-end p-6">
              <span className="text-accent-teal font-oswald text-[10px] tracking-[0.2em] uppercase mb-1 drop-shadow-[0_0_8px_rgba(45,212,191,0.8)]">
                {img.category}
              </span>
              <h3 className="text-white font-inter text-sm md:text-base font-medium tracking-wide drop-shadow-lg transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                {img.title}
              </h3>
            </div>
            
            {/* Soft border shine overlay */}
            <div className="absolute inset-0 rounded-2xl ring-1 ring-white/10 group-hover:ring-accent-green/30 transition-all duration-500 pointer-events-none" />
          </motion.div>
        ))}
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="relative w-full overflow-hidden bg-[#020503] pt-48 pb-16 z-20">
      {/* 180° Curved Background container */}
      <div 
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[140%] md:w-[110%] h-[400px] md:h-[600px] bg-gradient-to-b from-[#0a1a12] to-[#010301] pointer-events-none"
        style={{ 
          borderTopLeftRadius: "50% 100%", 
          borderTopRightRadius: "50% 100%",
          boxShadow: "inset 0 16px 80px rgba(52, 211, 153, 0.07)"
        }}
      />
      
      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center pt-20 px-6 text-center">
        {/* Soft magical glow behind text */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-accent-green/5 blur-[90px] rounded-full" />
        
        <h4 className="font-oswald text-2xl md:text-4xl text-white tracking-[0.2em] uppercase font-bold mb-3 drop-shadow-[0_0_15px_rgba(74,222,128,0.3)]">
          Naturalis
        </h4>
        <p className="font-inter text-xs md:text-sm text-white/50 tracking-wider mb-8 font-light">
          Created by Vishakh <span className="mx-2 text-accent-cyan/60">||</span> Software Developer & Frontend Architecture
        </p>

        {/* Minimalist Social Links */}
        <div className="flex gap-6">
          <a href="#" className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center bg-black/40 text-white/60 hover:text-white hover:bg-white/10 hover:border-white/30 transition-all duration-300">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
          </a>
          <a href="#" className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center bg-black/40 text-white/60 hover:text-white hover:bg-white/10 hover:border-white/30 transition-all duration-300">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
            </svg>
          </a>
        </div>
      </div>
    </footer>
  );
}
