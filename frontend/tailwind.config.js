/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand & Accents
        primary:   '#2563EB', // controlled blue for actions & active nav
        secondary: '#0F766E', // teal accent used sparingly
        
        // Warm Off-White Industrial Palette
        page:      '#F3F1EC', // warm off-white page background
        card:      '#FAF9F6', // soft ivory cards
        floor:     '#E5E2DA', // 3D floor light warm gray
        borderWarm:'#DDD9D0', // warm border
        hoverWarm: '#EAE7E0', // warm hover
        
        // Text
        heading:   '#1E293B', // slate primary text
        body:      '#334155', // slate secondary text
        muted:     '#64748B', // muted secondary text
        
        // Industrial Machine Statuses
        running:     '#22A06B',
        warning:     '#D99A06',
        fault:       '#D64545',
        maintenance: '#3978C8',
        verifying:   '#7C5CC4',
        offline:     '#7A7A73',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
}

