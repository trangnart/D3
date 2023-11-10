import "leaflet/dist/leaflet.css";
import "./style.css";
import leaflet from "leaflet";
import luck from "./luck";
import { Board } from "./board";
import { Cell } from "./board";
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

const board = new Board(TILE_DEGREES, NEIGHBORHOOD_SIZE);

interface CellSerial extends Cell {
  readonly serial: number;
}

class CoinCache {
  private static coins: Map<string, number> = new Map();

  static getCoin(cell: CellSerial): CellSerial {
    const key = `${cell.i},${cell.j}`;
    if (!this.coins.has(key)) {
      this.coins.set(key, 0);
    }

    const serial = this.coins.get(key)!;
    this.coins.set(key, serial + 1);

    const newCell: CellSerial = { i: cell.i, j: cell.j, serial };

    return newCell;
  }
}

function makePit(cell: Cell) {
  const cellSerial = CoinCache.getCoin(cell as CellSerial);
  const bounds = board.getCellBounds(cellSerial);

  const pit = leaflet.rectangle(bounds) as leaflet.Layer;

  pit.bindPopup(() => {
    let value = Math.floor(luck([cellSerial.i, cellSerial.j, "initialValue"].toString()) * 100);
    let coins = Math.floor(luck([cellSerial.i, cellSerial.j, "coinValue"].toString()) * 10);
    if (!deposits[`${cellSerial.i},${cellSerial.j}`]) {
      deposits[`${cellSerial.i},${cellSerial.j}`] = 0;
    }
    const container = document.createElement("div");
    container.innerHTML = `
        <div>There is a pit here at "${cellSerial.i},${cellSerial.j}, ${cellSerial.serial}". It has value <span id="value">${value}</span>. It has <span id="coins"> ${coins}</span> coins.</div>
        <button id="poke">poke</button>
        <button id="collectCoins">Collect</button>
        <button id="depositCoins">Deposit</button>
        <div>Collecting: <span id="inventory">${collectedCoins}</span></div>
        <div>Depositing: <span id="deposit">${
          deposits[`${cellSerial.i},${cellSerial.j}`]
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
        deposits[`${cellSerial.i},${cellSerial.j}`] += collectedCoins;
        collectedCoins = 0;
        inventoryDisplay.textContent = collectedCoins.toString();
        container.querySelector<HTMLSpanElement>("#deposit")!.innerHTML =
          deposits[`${cellSerial.i},${cellSerial.j}`].toString();
      }
    });
    return container;
  });
  pit.addTo(map);
}

const playerLocation = playerMarker.getLatLng();
const cellsNearPlayer = board.getCellsNearPoint(playerLocation);
cellsNearPlayer.forEach((cell) => {
  if (luck([cell.i, cell.j].toString()) < PIT_SPAWN_PROBABILITY) {
    makePit(cell);
  }
});
