/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Space Mono', 'monospace'],
        display: ['Archivo Black', 'sans-serif'],
      },
      colors: {
        'neo-yellow': '#FFF500',
        'neo-pink': '#FF00D6',
        'neo-blue': '#00F0FF',
        'neo-black': '#121212',
        'neo-red': '#FF2A00',
      },
      boxShadow: {
        'brutal': '4px 4px 0px 0px rgba(0,0,0,1)',
        'brutal-lg': '8px 8px 0px 0px rgba(0,0,0,1)',
      }
    },
  },
  plugins: [],
}
