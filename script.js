const cityInput = document.getElementById("city-input");
const suggestionsBox = document.getElementById("suggestions-box");
const searchBtn = document.getElementById("search-btn");
const statusMessage = document.getElementById("status-message");
const weatherContent = document.getElementById("weather-content");

const cityNameEl = document.getElementById("city-name");
const updateTimeEl = document.getElementById("update-time");
const temperatureEl = document.getElementById("temperature");
const weatherConditionEl = document.getElementById("weather-condition");
const apparentTempEl = document.getElementById("apparent-temp");
const weatherEmojiEl = document.getElementById("weather-emoji");

const humidityEl = document.getElementById("humidity");
const windSpeedEl = document.getElementById("wind-speed");
const rainChanceEl = document.getElementById("rain-chance");
const hourlyListEl = document.getElementById("hourly-list");

// Terjemahan kode cuaca WMO Open-Meteo
function getWeatherInfo(code) {
  if (code === 0) return { text: "Cerah", emoji: "☀️" };
  if (code === 1 || code === 2) return { text: "Cerah Berawan", emoji: "⛅" };
  if (code === 3) return { text: "Mendung", emoji: "☁️" };
  if (code === 45 || code === 48) return { text: "Berkabut", emoji: "🌫️" };
  if (code >= 51 && code <= 57) return { text: "Gerimis Ringan", emoji: "🌦️" };
  if (code >= 61 && code <= 67) return { text: "Hujan", emoji: "🌧️" };
  if (code >= 80 && code <= 82) return { text: "Hujan Lebat", emoji: "⛈️" };
  if (code >= 95 && code <= 99) return { text: "Badai Petir", emoji: "🌩️" };
  return { text: "Berawan", emoji: "🌤️" };
}

function showStatus(message, type = "") {
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`.trim();
}

// 1. Mencari daftar lokasi yang mendekati ketikan pengguna
async function fetchCitySuggestions(query) {
  if (!query || query.length < 2) {
    suggestionsBox.classList.add("hidden");
    suggestionsBox.innerHTML = "";
    return;
  }

  try {
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=6&language=id&format=json`,
    );
    const geoData = await geoRes.json();

    if (!geoData.results || geoData.results.length === 0) {
      suggestionsBox.classList.add("hidden");
      suggestionsBox.innerHTML = "";
      return;
    }

    suggestionsBox.innerHTML = "";
    geoData.results.forEach((loc) => {
      const item = document.createElement("div");
      item.className = "suggestion-item";

      const regionParts = [loc.admin2, loc.admin1, loc.country].filter(Boolean);
      const regionText = regionParts.join(", ");

      item.innerHTML = `
                <span class="suggestion-city">${loc.name}</span>
                <span class="suggestion-region">${regionText}</span>
            `;

      // Langsung ambil cuaca saat salah satu opsi diklik
      item.addEventListener("click", () => {
        cityInput.value = loc.name;
        suggestionsBox.classList.add("hidden");
        fetchWeatherByCoords(loc.latitude, loc.longitude, loc.name, regionText);
      });

      suggestionsBox.appendChild(item);
    });

    suggestionsBox.classList.remove("hidden");
  } catch (error) {
    console.error("Gagal memuat saran lokasi:", error);
  }
}

// 2. Mengambil data cuaca lengkap berdasarkan lokasi terpilih
async function fetchWeatherByCoords(latitude, longitude, cityName, regionFull) {
  showStatus("Memuat data cuaca...", "loading");
  weatherContent.classList.add("hidden");

  try {
    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&hourly=temperature_2m,apparent_temperature,relativehumidity_2m,precipitation_probability,weathercode&timezone=auto`,
    );
    const weatherData = await weatherRes.json();

    const current = weatherData.current_weather;
    const hourly = weatherData.hourly;

    // Cari indeks jam saat ini di array hourly
    const currentHourStr = current.time.slice(0, 13);
    let nowIndex = hourly.time.findIndex((t) => t.startsWith(currentHourStr));
    if (nowIndex === -1) nowIndex = new Date().getHours();

    const currentHumidity = hourly.relativehumidity_2m
      ? hourly.relativehumidity_2m[nowIndex]
      : "--";
    const currentRainProb = hourly.precipitation_probability
      ? hourly.precipitation_probability[nowIndex]
      : 0;
    const apparentTemp = hourly.apparent_temperature
      ? Math.round(hourly.apparent_temperature[nowIndex])
      : Math.round(current.temperature);

    const info = getWeatherInfo(current.weathercode);

    // Update UI Utama
    cityNameEl.textContent = `${cityName}, ${regionFull}`;
    updateTimeEl.textContent = `Waktu lokal: ${current.time.replace("T", " ")}`;
    temperatureEl.textContent = current.temperature.toFixed(1);
    weatherConditionEl.textContent = info.text;
    weatherEmojiEl.textContent = info.emoji;
    apparentTempEl.textContent = `Terasa seperti ${apparentTemp}°C`;

    humidityEl.textContent = `${currentHumidity}%`;
    windSpeedEl.textContent = `${current.windspeed} km/j`;
    rainChanceEl.textContent = `${currentRainProb}%`;

    // Render Prakiraan Per Jam (8 jam ke depan)
    hourlyListEl.innerHTML = "";
    for (let i = nowIndex; i < nowIndex + 8 && i < hourly.time.length; i++) {
      const timeString = hourly.time[i].split("T")[1];
      const temp = hourly.temperature_2m[i].toFixed(1);
      const code = hourly.weathercode[i];
      const hourlyInfo = getWeatherInfo(code);

      const itemDiv = document.createElement("div");
      itemDiv.className = "hourly-item";
      itemDiv.innerHTML = `
                <span class="hourly-time">${timeString}</span>
                <span class="hourly-desc">${hourlyInfo.emoji} ${hourlyInfo.text}</span>
                <span class="hourly-temp">${temp}°C</span>
            `;
      hourlyListEl.appendChild(itemDiv);
    }

    showStatus("Data cuaca berhasil diperbarui.");
    weatherContent.classList.remove("hidden");
  } catch (error) {
    showStatus(
      "Terjadi kesalahan jaringan. Periksa koneksi internet Anda.",
      "error",
    );
    console.error(error);
  }
}

// Event saat pengguna mengetik (dengan jeda 300ms agar tidak spam request)
let debounceTimer;
cityInput.addEventListener("input", (e) => {
  clearTimeout(debounceTimer);
  const query = e.target.value.trim();
  debounceTimer = setTimeout(() => {
    fetchCitySuggestions(query);
  }, 300);
});

// Sembunyikan saran jika klik di luar kolom pencarian
document.addEventListener("click", (e) => {
  if (!e.target.closest(".search-wrapper")) {
    suggestionsBox.classList.add("hidden");
  }
});

// Pencarian manual lewat tombol "Cari" atau Enter
async function handleManualSearch() {
  const query = cityInput.value.trim();
  if (!query) {
    showStatus("Silakan masukkan nama kota terlebih dahulu.", "error");
    weatherContent.classList.add("hidden");
    return;
  }

  suggestionsBox.classList.add("hidden");
  showStatus("Mencari lokasi...", "loading");

  try {
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=id&format=json`,
    );
    const geoData = await geoRes.json();

    if (!geoData.results || geoData.results.length === 0) {
      showStatus(`Kota "${query}" tidak ditemukan.`, "error");
      weatherContent.classList.add("hidden");
      return;
    }

    const loc = geoData.results[0];
    const regionParts = [loc.admin2, loc.admin1, loc.country].filter(Boolean);
    fetchWeatherByCoords(
      loc.latitude,
      loc.longitude,
      loc.name,
      regionParts.join(", "),
    );
  } catch (error) {
    showStatus("Gagal mencari lokasi. Periksa koneksi internet.", "error");
  }
}

searchBtn.addEventListener("click", handleManualSearch);

cityInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    handleManualSearch();
  }
});
