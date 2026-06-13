import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#EEF1F7",
        foreground: "#0D1B4B",
        card: "#FFFFFF",
        border: "#DCE4F0",
        accent: "#3D82DE",
        "accent-hover": "#2E6FC9",
        muted: "#5E6C92",
      },
      fontFamily: {
        sans: ['"Inter Tight"', "system-ui", "-apple-system", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
