NEXUS — PREMIUM UI COMPLETE PROJECT
==================================
This is one complete standalone project. Do not merge it with your older NEXUS folders.

FIRST RUN (Windows / VS Code)
1. Extract this ZIP to a folder, for example Desktop\NEXUS_PREMIUM_UI.
2. In VS Code choose File > Open Folder and select the extracted folder.
3. Open Terminal > New Terminal and run:
       npm install
4. Start the API in terminal 1:
       npm run api
   Keep it running. It should say NEXUS API listening on http://localhost:4000.
5. Open a SECOND terminal using the + button and run:
       npm run dev
6. Open the local URL printed by Vite (usually http://127.0.0.1:5173).

WHAT'S INCLUDED
- Premium forest-green, cream and soft-coral design with responsive layouts.
- Custom local SVG illustration (no external image download needed for the hero artwork).
- Subtle entrance, hover, pulse and floating-orbit animations; respects reduced-motion preferences.
- Donor workflow: category selection, custom Other item, quantities, food safety deadlines, optional donation photo preview.
- Shelter/community kitchen workflow: centre registration, custom Other needs, optional centre photo preview.
- Volunteer/rider delivery assignment and status updates with issue reporting.
- Coordinator dashboard, network metrics, delivery exceptions and activity overview.
- Interactive Leaflet/OpenStreetMap pin picker and overview map.
- Express API saves donations, centre needs and delivery state locally in server/data/state.json.

IMPORTANT NOTES
- Keep both terminals running while testing the frontend and API together.
- Photos uploaded in the workflow are optional and limited to 1.5 MB each for this demo.
- The API uses local demo storage; production authentication and cloud sync are not configured.
- The first npm install requires internet access to download dependencies.
