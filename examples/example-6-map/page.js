"use strict";

/* global grist, window */

grist.ready();

window.onload = function() {
  const api = grist.rpc.getStub("GristDocAPI@grist", grist.checkers.GristDocAPI);
  api.listTables()
    .then(tables => {
      return api.fetchTable(tables[0]);
    })
    .then(data => {
      if (!data) {
        console.log("No table found");
        return;
      }
      if (!(data.long && data.lat && data.Name)) {
        console.log("table does not have all needed columns: long, lag, Name");
        return;
      }
      const tiles = L.tileLayer('//server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}', {
	maxZoom: 18,
	attribution: 'Tiles &copy; Esri &mdash; National Geographic, Esri, DeLorme, NAVTEQ, UNEP-WCMC, USGS, NASA, ESA, METI, NRCAN, GEBCO, NOAA, iPC'
      });
      const map = L.map('map', {layers: [tiles]});
      const markers = L.markerClusterGroup();
      const points = [];
      for (let i = 0; i < data.id.length; i++) {
        const pt = new L.LatLng(data.lat[i], data.long[i]);
        const title = data.Name[i];
        const marker = L.marker(pt, { title  });
        points.push(pt);
	marker.bindPopup(title);
	markers.addLayer(marker);
      }
      map.addLayer(markers);
      map.fitBounds(new L.LatLngBounds(points));
    });
};
