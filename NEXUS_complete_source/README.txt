NEXUS source bundle

Files included:
- src/App.tsx: NEXUS multi-role app, map, donor and shelter flows, local demo persistence
- src/App.css: responsive green/cream styling
- src/main.tsx: React entry point
- src/index.css: global styles

How to use:
1. Unzip this folder.
2. In your existing Vite project, replace the matching files inside src/ with these files.
3. Make sure these packages are installed from your project folder:
   npm install leaflet react-leaflet lucide-react
   npm install -D @types/leaflet
4. Run:
   npm run dev

Important:
This is a browser-local prototype. Records are saved in localStorage and are not shared across devices.
Real authentication, geocoding, routing, backend sync, and production-grade food safety validation are not configured.
