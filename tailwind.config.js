/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: '#042C53', mid: '#185FA5', light: '#E6F1FB' },
        teal: { DEFAULT: '#0F6E56', mid: '#1D9E75', light: '#E1F5EE' },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] }
    }
  },
  plugins: []
}
