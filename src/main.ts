import "leaflet/dist/leaflet.css";
import "./style.css";
import leaflet from "leaflet";
import luck from "./luck";
import { Board, Cell } from "./board";
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
const movementHistory: leaflet.LatLng[] = [];

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

interface Momento<T> {
  toMomento(): T;
  fromMomento(momento: T): void;
}

class Geocache implements Momento<string> {
  i: number;
  j: number;
  serial: number;
  numCoins: number;

  static caches: Map<string, number> = new Map();

  constructor(cell: CellSerial) {
    this.i = cell.i;
    this.j = cell.j;
    this.serial = cell.serial;
    this.numCoins = Math.floor(
      luck([cell.i, cell.j, "coinValue"].toString()) * 10
    );
  }

  toMomento() {
    return JSON.stringify({
      i: this.i,
      j: this.j,
      serial: this.serial,
      numCoins: this.numCoins,
    });
  }

  fromMomento(momento: string) {
    const data = JSON.parse(momento);
    this.i = data.i;
    this.j = data.j;
    this.serial = data.serial;
    this.numCoins = data.numCoins;
  }

  static getCache(cell: Cell): Geocache {
    const key = `${cell.i},${cell.j}`;
    if (!this.caches.has(key)) {
      this.caches.set(key, Math.floor(Math.random() * 100));
    }

    const serial = this.caches.get(key)!;

    const newCell: CellSerial = { i: cell.i, j: cell.j, serial };

    const newCache = new Geocache(newCell);

    return newCache;
  }
}

function makePit(cell: Cell) {
  const cellSerial = Geocache.getCache(cell as CellSerial);
  const bounds = board.getCellBounds(cellSerial);

  const pit = leaflet.rectangle(bounds) as leaflet.Layer;

  pit.bindPopup(() => {
    let value = Math.floor(
      luck([cellSerial.i, cellSerial.j, "initialValue"].toString()) * 100
    );
    /*let coins = Math.floor(
      luck([cellSerial.i, cellSerial.j, "coinValue"].toString()) * 10
    );*/
    if (!deposits[`${cellSerial.i},${cellSerial.j}`]) {
      deposits[`${cellSerial.i},${cellSerial.j}`] = 0;
    }
    const container = document.createElement("div");
    container.innerHTML = `
        <div>There is a pit here at "${cellSerial.i},${cellSerial.j}, ${
      cellSerial.serial
    }". It has value <span id="value">${value}</span>. It has <span id="coins"> ${
      Geocache.getCache(cell).numCoins
    } </span> coins.</div>
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
      const coin = Geocache.getCache(cell);
      collectedCoins += coin.numCoins;
      coin.numCoins = 0;

      container.querySelector<HTMLDivElement>("#coins")!.innerHTML =
        coin.numCoins.toString();
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

const movementPolyline = leaflet
  .polyline([], {
    color: "green",
  })
  .addTo(map);
const playerLocation = playerMarker.getLatLng();
const cellsNearPlayer = board.getCellsNearPoint(playerLocation);
cellsNearPlayer.forEach((cell) => {
  if (luck([cell.i, cell.j].toString()) < PIT_SPAWN_PROBABILITY) {
    makePit(cell);
  }
});

sensorButton.addEventListener("click", () => {
  navigator.geolocation.watchPosition((position) => {
    const newPosition = leaflet.latLng(
      position.coords.latitude,
      position.coords.longitude
    );

    movementHistory.push(newPosition);

    playerMarker.setLatLng(newPosition);
    map.setView(newPosition);

    movementPolyline.setLatLngs(movementHistory);
  });
});

const northButton = document.querySelector("#north")!;
northButton.addEventListener("click", () => move("north"));

const southButton = document.querySelector("#south")!;
southButton.addEventListener("click", () => move("south"));

const westButton = document.querySelector("#west")!;
westButton.addEventListener("click", () => move("west"));

const eastButton = document.querySelector("#east")!;
eastButton.addEventListener("click", () => move("east"));

function move(direction: string) {
  const currentLocation = playerMarker.getLatLng();
  let newLocation: leaflet.LatLng;

  switch (direction) {
    case "north":
      newLocation = leaflet.latLng(
        currentLocation.lat + TILE_DEGREES,
        currentLocation.lng
      );
      break;
    case "south":
      newLocation = leaflet.latLng(
        currentLocation.lat - TILE_DEGREES,
        currentLocation.lng
      );
      break;
    case "west":
      newLocation = leaflet.latLng(
        currentLocation.lat,
        currentLocation.lng - TILE_DEGREES
      );
      break;
    case "east":
      newLocation = leaflet.latLng(
        currentLocation.lat,
        currentLocation.lng + TILE_DEGREES
      );
      break;
    default:
      return;
  }

  movementHistory.push(newLocation);

  movementPolyline.setLatLngs(movementHistory);

  map.eachLayer((layer) => {
    if (layer instanceof leaflet.Rectangle) {
      map.removeLayer(layer);
    }
  });

  const cellsNearPlayer = board.getCellsNearPoint(newLocation);
  cellsNearPlayer.forEach((cell) => {
    if (luck([cell.i, cell.j].toString()) < PIT_SPAWN_PROBABILITY) {
      makePit(cell);
    }
  });

  playerMarker.setLatLng(newLocation);
  map.setView(newLocation);
}

const resetButton = document.querySelector("#reset")!;
resetButton.addEventListener("click", resetGame);

function resetGame() {
  collectedCoins = 0;

  for (const key in deposits) {
    deposits[key] = 0;
  }

  movementHistory.length = 0;

  map.eachLayer((layer) => {
    if (layer instanceof leaflet.Rectangle) {
      map.removeLayer(layer);
    }
  });

  playerMarker.setLatLng(MERRILL_CLASSROOM);
  map.setView(MERRILL_CLASSROOM);

  movementPolyline.setLatLngs([]);

  points = 0;
  statusPanel.innerHTML = "No points yet...";

  const cellsNearPlayer = board.getCellsNearPoint(MERRILL_CLASSROOM);
  cellsNearPlayer.forEach((cell) => {
    if (luck([cell.i, cell.j].toString()) < PIT_SPAWN_PROBABILITY) {
      makePit(cell);
    }
  });
}
