
# ArcGIS Web Component + NEPA Assist & IPaC Geospatial Screen

This project is a Node.js application using Express to serve a static HTML page with the ArcGIS map web component. It provides a dual geospatial API interface for NEPA Assist and IPaC, with a modern UI for drawing, buffering, and viewing results.

## Features
- Draw geometry on the map and view its Esri JSON string (displayed next to buffer input)
- Set a buffer size below the map
- Click "Geospatial Screen" to call both NEPA Assist and IPaC APIs
- Results are shown in two side-by-side panes
  - Each pane displays the full curl command for the API call (URL and JSON body)
  - Results auto-resize to fit returned JSON
- IPaC API is only called for supported geometry types (Polygon, LineString)

## Getting Started

1. **Install dependencies:**
   ```sh
   npm install
   ```

2. **Start the server:**
   ```sh
   node index.js
   ```

3. **Open your browser:**
   Visit [http://localhost:3000](http://localhost:3000)

4. **Usage:**
   - Draw a shape on the map using the sketch tool
   - Set your buffer size in the input below the map
   - View the Esri JSON location string next to the buffer input
   - Click "Geospatial Screen" to call both APIs and view results/curl commands

## Notes
- The NEPA Assist API is accessed via a backend proxy to avoid CORS issues, but the actual API URL is shown in the UI.
- All static files are served from the `public` directory.
- IPaC API is called directly from the browser.

## Requirements
- Node.js (v18 or newer recommended)

---

For more info on the NEPA Assist API, see [EPA NEPA Assist API Documentation](https://nepassisttool.epa.gov/nepassist/nepassistapi.html).
For more info on the IPaC Location API, see [FWS IPaC API Documentation](https://ipacb.ecosphere.fws.gov/location/api/).
