import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    // Safelist nail tech color classes to prevent purging in production
    // Use pattern matching to ensure all variations are included
    {
      pattern: /^(bg|text|border)-(blue|purple|pink|indigo|teal|amber|rose|cyan|emerald|violet|fuchsia|orange|lime|sky|yellow)-(500|700|900)$/,
    },
    {
      pattern: /^shadow-(blue|purple|pink|indigo|teal|amber|rose|cyan|emerald|violet|fuchsia|orange|lime|sky|yellow)-500\/50$/,
    },
    // Also include specific classes as fallback
    'bg-blue-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-teal-500',
    'bg-amber-500',
    'bg-rose-500',
    'bg-cyan-500',
    'bg-emerald-500',
    'bg-violet-500',
    'bg-fuchsia-500',
    'bg-orange-500',
    'bg-lime-500',
    'bg-sky-500',
    'bg-yellow-500',
    'text-white',
    'text-slate-900',
    'border-blue-700',
    'border-purple-700',
    'border-pink-700',
    'border-indigo-700',
    'border-teal-700',
    'border-amber-700',
    'border-rose-700',
    'border-cyan-700',
    'border-emerald-700',
    'border-violet-700',
    'border-fuchsia-700',
    'border-orange-700',
    'border-lime-700',
    'border-sky-700',
    'border-yellow-700',
    'shadow-lg',
    'shadow-blue-500/50',
    'shadow-purple-500/50',
    'shadow-pink-500/50',
    'shadow-indigo-500/50',
    'shadow-teal-500/50',
    'shadow-amber-500/50',
    'shadow-rose-500/50',
    'shadow-cyan-500/50',
    'shadow-emerald-500/50',
    'shadow-violet-500/50',
    'shadow-fuchsia-500/50',
    'shadow-orange-500/50',
    'shadow-lime-500/50',
    'shadow-sky-500/50',
    'shadow-yellow-500/50',
  ],
  theme: {
    extend: {
      colors: {
        background: "#FFFFFF",
        foreground: "#000000",
        accent: "#000000",
        subtext: "#666666",
      },
      fontFamily: {
        heading: ['var(--font-playfair)', 'serif'],
        body: ['var(--font-lato)', 'sans-serif'],
        balgor: ['var(--font-balgor)', 'sans-serif'],
        acollia: ['var(--font-acollia)', 'sans-serif'],
        ladinta: ['var(--font-ladinta)', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;

