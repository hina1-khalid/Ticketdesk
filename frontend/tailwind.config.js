export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { display: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'], sans: ['"Public Sans"', 'system-ui', 'sans-serif'] },
      colors: {
        ink: { DEFAULT: '#16212B', soft: '#5B6B79', mute: '#8996A3' },
        paper: { DEFAULT: '#F4F6F5', card: '#FFFFFF', line: '#E1E7E5' },
        brand: { DEFAULT: '#0F5C5A', dark: '#0A4442', light: '#DDEFED' },
        signal: { amber: '#E3A02B', red: '#C8452C', green: '#3C8D5A', blue: '#3B6FA8' },
        night: { DEFAULT: '#0F1519', card: '#172027', line: '#26323B' }
      }
    }
  },
  plugins: []
};
