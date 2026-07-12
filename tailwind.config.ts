import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        madre: {
          DEFAULT: "#7c1d1d",
          50: "#fbf3f3",
          100: "#f6e3e3",
          600: "#7c1d1d",
          700: "#611616",
          900: "#3d0f0f",
        },
      },
    },
  },
  plugins: [],
};

export default config;
