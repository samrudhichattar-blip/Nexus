NEXUS v2 - updated source

Replace the matching files in your existing Vite project's src folder with these four files:
- App.tsx
- App.css
- main.tsx
- index.css

Run in the project terminal:
npm install leaflet react-leaflet lucide-react
npm install -D @types/leaflet
npm run dev

What's new:
- Donor four-stage workflow: items, quantity, expiry/handling, review/submit
- Cooked meal deadline validation (requires prep time; max 8 hours after preparation)
- Shelter demand registration with facilities and status
- Volunteer can accept a compatible donation for an active centre
- Delivery milestone tracking: Accepted -> Heading to pickup -> Picked up -> In transit -> Delivered
- Delivery issue reporting and coordinator review/release controls
- Coordinator centre status management and donation expiry visibility
- Map pins and OpenStreetMap attribution retained
- Local browser persistence for donations, demands and deliveries

Limitations shown in UI:
- This is a local browser demo, not a cross-device service
- Authentication, shared backend, live geocoding and route provider are not configured
- Quantity splitting is not enabled
- Handling rules are prototype safeguards, not food-safety certification
