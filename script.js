
const map = L.map("map", {
    zoomControl: false
}).setView([48.8566, 2.3522], 9);
L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
    }
).addTo(map);

L.control.zoom({
    position: "bottomright"
}).addTo(map);
let stations = [];
let markers = [];
let selectedFuel = "all";
let selectedStation = null;

const stationList = document.getElementById("stationList");
const stationCount = document.getElementById("stationCount");
const resultCount = document.getElementById("resultCount");
const searchInput = document.getElementById("searchInput");
const stationPanel = document.getElementById("stationPanel");

const fuelNames = {
    price_gazole: "Gazole",
    price_sp95: "SP95",
    price_sp98: "SP98",
    price_e10: "E10",
    price_e85: "E85",
    price_gplc: "GPLc"
};

function getCoordinates(station) {
    const point = station.geo_point || station.coordinates || {};

    const lat = Number(
        point.lat ?? station.latitude ?? station.lat
    );

    const lon = Number(
        point.lon ?? point.lng ?? station.longitude ?? station.lon
    );

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return null;
    }

    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        return null;
    }

    return [lat, lon];
}

function getName(station) {
    return station.name ||
        station.nom ||
        station.station ||
        station.libelle ||
        "Station sans nom";
}

function getBrand(station) {
    return station.brand ||
        station.marque ||
        station.enseigne ||
        "Enseigne inconnue";
}

function getCity(station) {
    return station.city ||
        station.ville ||
        station.commune ||
        "";
}

function getAddress(station) {
    return station.address ||
        station.adresse ||
        "";
}

function getPostcode(station) {
    return station.postcode ||
        station.code_postal ||
        station.cp ||
        "";
}

function getFuelPrice(station, fuelKey) {
    const price = station[fuelKey];

    if (price !== undefined && price !== null && price !== "") {
        return price;
    }

    if (station.prices && station.prices[fuelKey] !== undefined) {
        return station.prices[fuelKey];
    }

    return null;
}

function formatPrice(price) {
    if (price === null || price === undefined || price === "") {
        return "Non disponible";
    }

    const value = Number(String(price).replace(",", "."));

    if (!Number.isFinite(value)) {
        return String(price);
    }

    return value.toFixed(3).replace(".", ",") + " €";
}

function hasFuelPrice(station, fuelKey) {
    const price = getFuelPrice(station, fuelKey);
    return price !== null && price !== undefined && price !== "";
}
async function loadStations() {
    try {
        const response = await fetch("./stations.json");

        if (!response.ok) {
            throw new Error("Impossible de charger stations.json");
        }

        const data = await response.json();
        if (Array.isArray(data)) {
            stations = data;
        } else if (data.features && Array.isArray(data.features)) {
            stations = data.features.map(feature => ({
                ...feature.properties,
                geo_point: {
                    lat: feature.geometry.coordinates[1],
                    lon: feature.geometry.coordinates[0]
                }
            }));
        } else {
            throw new Error("Format JSON non reconnu");
        }
        stations = stations.filter(station => getCoordinates(station));

        stationCount.textContent = stations.length;

        renderStations();

    } catch (error) {
        console.error(error);

        stationList.innerHTML = `
            <div class="empty-state">
                Impossible de charger les stations.<br>
                Vérifie le fichier stations.json.
            </div>
        `;

        stationCount.textContent = "Erreur";
        resultCount.textContent = "0 résultat";
    }
}

function createMarker(station) {
    const coordinates = getCoordinates(station);

    const icon = L.divIcon({
        className: "",
        html: '<div class="station-marker"></div>',
        iconSize: [18, 18],
        iconAnchor: [9, 9]
    });

    const marker = L.marker(coordinates, {
        icon: icon
    });

    marker.on("click", () => {
        selectStation(station);
    });

    return marker;
}

function renderStations() {
    const search = searchInput.value.toLowerCase().trim();
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];

    stationList.innerHTML = "";

    let visibleStations = stations.filter(station => {

        const searchableText = [
            getName(station),
            getBrand(station),
            getCity(station),
            getAddress(station),
            getPostcode(station)
        ].join(" ").toLowerCase();

        const matchesSearch = searchableText.includes(search);

        const matchesFuel =
            selectedFuel === "all" ||
            hasFuelPrice(station, selectedFuel);

        return matchesSearch && matchesFuel;
    });

    stationCount.textContent = visibleStations.length;
    resultCount.textContent =
        visibleStations.length + " résultat(s)";

    if (visibleStations.length === 0) {
        stationList.innerHTML = `
            <div class="empty-state">
                Aucune station ne correspond à votre recherche.
            </div>
        `;
        return;
    }

    visibleStations.forEach(station => {

        const marker = createMarker(station);

        marker.addTo(map);
        markers.push(marker);
        const card = document.createElement("button");

        card.className = "station-card";

        if (selectedStation === station) {
            card.classList.add("selected");
        }

        const location = [
            getPostcode(station),
            getCity(station)
        ].filter(Boolean).join(" ");

        let priceText = "Prix non renseigné";

        if (selectedFuel !== "all") {
            priceText = formatPrice(
                getFuelPrice(station, selectedFuel)
            );
        } else {
            const availableFuel = Object.keys(fuelNames)
                .find(key => hasFuelPrice(station, key));

            if (availableFuel) {
                priceText = fuelNames[availableFuel] + " : " +
                    formatPrice(getFuelPrice(station, availableFuel));
            }
        }

        const title = document.createElement("h3");
        title.textContent = getName(station);

        const address = document.createElement("p");
        address.textContent = location || getAddress(station);

        const bottom = document.createElement("div");
        bottom.className = "card-bottom";

        const brand = document.createElement("span");
        brand.className = "station-brand";
        brand.textContent = getBrand(station);

        const price = document.createElement("span");
        price.className = "station-price";
        price.textContent = priceText;

        bottom.append(brand, price);
        card.append(title, address, bottom);

        card.addEventListener("click", () => {
            selectStation(station);
        });

        stationList.appendChild(card);
    });
}

function selectStation(station) {
    selectedStation = station;

    const coordinates = getCoordinates(station);

    map.flyTo(coordinates, 15, {
        duration: 1.2
    });

    showStationDetails(station);
    renderStations();
}

function showStationDetails(station) {
    stationPanel.classList.remove("hidden");
    stationPanel.innerHTML = "";

    const closeButton = document.createElement("button");
    closeButton.className = "detail-close";
    closeButton.textContent = "×";
    closeButton.addEventListener("click", () => {
        stationPanel.classList.add("hidden");
        selectedStation = null;
        renderStations();
    });

    const tag = document.createElement("span");
    tag.className = "detail-tag";
    tag.textContent = getBrand(station);

    const title = document.createElement("h2");
    title.textContent = getName(station);

    const address = document.createElement("p");
    address.className = "detail-address";

    address.textContent = [
        getAddress(station),
        getPostcode(station),
        getCity(station)
    ].filter(Boolean).join(", ");

    const divider = document.createElement("div");
    divider.className = "detail-divider";

    const priceTitle = document.createElement("div");
    priceTitle.className = "detail-title";
    priceTitle.textContent = "PRIX DES CARBURANTS";

    stationPanel.append(
        closeButton,
        tag,
        title,
        address,
        divider,
        priceTitle
    );

    let hasPrices = false;

    Object.entries(fuelNames).forEach(([key, label]) => {
        const price = getFuelPrice(station, key);

        if (!hasFuelPrice(station, key)) {
            return;
        }

        hasPrices = true;

        const row = document.createElement("div");
        row.className = "fuel-row";

        const fuelName = document.createElement("span");
        fuelName.textContent = label;

        const fuelPrice = document.createElement("strong");
        fuelPrice.textContent = formatPrice(price);

        row.append(fuelName, fuelPrice);
        stationPanel.appendChild(row);
    });

    if (!hasPrices) {
        const noPrice = document.createElement("p");
        noPrice.className = "detail-address";
        noPrice.textContent = "Aucun prix disponible pour cette station.";
        stationPanel.appendChild(noPrice);
    }
}
document.querySelectorAll(".filter-btn").forEach(button => {

    button.addEventListener("click", () => {

        document.querySelectorAll(".filter-btn").forEach(btn => {
            btn.classList.remove("active");
        });

        button.classList.add("active");

        selectedFuel = button.dataset.fuel;

        renderStations();
    });

});
searchInput.addEventListener("input", () => {
    renderStations();
});
document.getElementById("resetFilters").addEventListener("click", () => {

    searchInput.value = "";
    selectedFuel = "all";

    document.querySelectorAll(".filter-btn").forEach(button => {
        button.classList.toggle(
            "active",
            button.dataset.fuel === "all"
        );
    });

    renderStations();
});


document.getElementById("resetMap").addEventListener("click", () => {

    selectedStation = null;
    stationPanel.classList.add("hidden");

    if (markers.length > 0) {
        const group = L.featureGroup(markers);
        map.fitBounds(group.getBounds(), {
            padding: [50, 50],
            maxZoom: 11
        });
    } else {
        map.setView([48.8566, 2.3522], 9);
    }

    renderStations();
});

loadStations();
