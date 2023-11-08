import "leaflet/dist/leaflet.css";
import "./style.css";
import leaflet from "leaflet";
import luck from "./luck";
import "./leafletWorkaround";

const MERRILL_CLASSROOM = leaflet.latLng({
  lat: 36.9995,
  lng: -122.0533,
});

let collectedCoins = 0;
const deposits: { [key: string]: number } = {};
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 8;
const PIT_SPAWN_PROBABILITY = 0.1;

const mapContainer = document.querySelector<HTMLElement>("#map")!;

const map = leaflet.map(mapContainer, {
  center: MERRILL_CLASSROOM,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});

leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

const playerMarker = leaflet.marker(MERRILL_CLASSROOM);
playerMarker.bindTooltip("That's you!");
playerMarker.addTo(map);

const sensorButton = document.querySelector("#sensor")!;
sensorButton.addEventListener("click", () => {
  navigator.geolocation.watchPosition((position) => {
    playerMarker.setLatLng(
      leaflet.latLng(position.coords.latitude, position.coords.longitude)
    );
    map.setView(playerMarker.getLatLng());
  });
});

let points = 0;
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
statusPanel.innerHTML = "No points yet...";

function makePit(i: number, j: number) {
  const bounds = leaflet.latLngBounds([
    [
      MERRILL_CLASSROOM.lat + i * TILE_DEGREES,
      MERRILL_CLASSROOM.lng + j * TILE_DEGREES,
    ],
    [
      MERRILL_CLASSROOM.lat + (i + 1) * TILE_DEGREES,
      MERRILL_CLASSROOM.lng + (j + 1) * TILE_DEGREES,
    ],
  ]);

  const pit = leaflet.rectangle(bounds) as leaflet.Layer;

  pit.bindPopup(() => {
    let value = Math.floor(luck([i, j, "initialValue"].toString()) * 100);
    let coins = Math.floor(luck([i, j, "coinValue"].toString()) * 10);
    if (!deposits[`${i},${j}`]) {
      deposits[`${i},${j}`] = 0;
    }
    const container = document.createElement("div");
    container.innerHTML = `
        <div>There is a pit here at "${i},${j}". It has value <span id="value">${value}</span>. It has <span id="coins"> ${coins}</span> coins.</div>
        <button id="poke">poke</button>
        <button id="collectCoins">Collect</button>
        <button id="depositCoins">Deposit</button>
        <div>Collecting: <span id="inventory">${collectedCoins}</span></div>
        <div>Depositing: <span id="deposit">${
          deposits[`${i},${j}`]
        }</span></div>`;

    const poke = container.querySelector<HTMLButtonElement>("#poke")!;
    const inventoryDisplay =
      container.querySelector<HTMLSpanElement>("#inventory")!;
    const collectButton =
      container.querySelector<HTMLButtonElement>("#collectCoins")!;
    const depositButton =
      container.querySelector<HTMLButtonElement>("#depositCoins")!;

    poke.addEventListener("click", () => {
      if (value > 0) {
        value--;
        container.querySelector<HTMLSpanElement>("#value")!.innerHTML =
          value.toString();
        points++;
        statusPanel.innerHTML = `${points} points accumulated`;
      }
    });
    collectButton.addEventListener("click", () => {
      collectedCoins += coins;
      coins = 0;
      container.querySelector<HTMLDivElement>("#coins")!.innerHTML =
        coins.toString();
      inventoryDisplay.innerHTML = collectedCoins.toString();
    });
    depositButton.addEventListener("click", () => {
      if (collectedCoins > 0) {
        deposits[`${i},${j}`] += collectedCoins;
        collectedCoins = 0;
        inventoryDisplay.textContent = collectedCoins.toString();
        container.querySelector<HTMLSpanElement>("#deposit")!.innerHTML =
          deposits[`${i},${j}`].toString();
      }
    });
    return container;
  });
  pit.addTo(map);
}

for (let i = -NEIGHBORHOOD_SIZE; i < NEIGHBORHOOD_SIZE; i++) {
  for (let j = -NEIGHBORHOOD_SIZE; j < NEIGHBORHOOD_SIZE; j++) {
    if (luck([i, j].toString()) < PIT_SPAWN_PROBABILITY) {
      makePit(i, j);
    }
  }
}
