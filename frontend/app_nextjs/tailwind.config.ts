import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        Gummy: ["Sour Gummy"],
        Park: ["Parkinsans"],
        Atkinson: ["Atkinson Hyperlegible Next"],
      },
    },
  },
  plugins: [require("tailwind-scrollbar")],
};

export default config;
