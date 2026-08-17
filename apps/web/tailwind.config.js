/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--defaultFont-sans)"],
        display: ["var(--defaultFont-sans)"],
        body: ["var(--defaultFont-sans)"],
        mono: ["var(--defaultFont-mono)"],
      },
      fontSize: {
        "cds-display-1": ["var(--fontSize-display1)", { lineHeight: "var(--lineHeight-display1)", fontWeight: "400" }],
        "cds-display-2": ["var(--fontSize-display2)", { lineHeight: "var(--lineHeight-display2)", fontWeight: "400" }],
        "cds-display-3": ["var(--fontSize-display3)", { lineHeight: "var(--lineHeight-display3)", fontWeight: "400" }],
        "cds-title-1": ["var(--fontSize-title1)", { lineHeight: "var(--lineHeight-title1)", fontWeight: "600" }],
        "cds-title-3": ["var(--fontSize-title3)", { lineHeight: "var(--lineHeight-title3)", fontWeight: "600" }],
        "cds-headline": ["var(--fontSize-headline)", { lineHeight: "var(--lineHeight-headline)", fontWeight: "600" }],
        "cds-body": ["var(--fontSize-body)", { lineHeight: "var(--lineHeight-body)", fontWeight: "400" }],
        "cds-label-1": ["var(--fontSize-label1)", { lineHeight: "var(--lineHeight-label1)", fontWeight: "600" }],
        "cds-caption": ["var(--fontSize-caption)", { lineHeight: "var(--lineHeight-caption)", fontWeight: "600" }],
      },
      animation: {
        "fade-up": "rg-fade-up 0.45s cubic-bezier(0.22, 1, 0.36, 1) both",
        "pulse-soft": "rg-pulse 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
}
