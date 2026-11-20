#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <DHT.h>
#include <BH1750.h>

#if __has_include("config.local.h")
#include "config.local.h"
#else
#include "config.h"
#endif

constexpr uint8_t DHT_PIN = 4;
constexpr uint8_t LED_PIN = 18;
constexpr uint8_t SDA_PIN = 21;
constexpr uint8_t SCL_PIN = 22;
constexpr unsigned long INTERVAL_MS = 300000UL;

DHT dht(DHT_PIN, DHT22);
BH1750 lightMeter;
unsigned long lastCycle = 0;
bool firstCycle = true;
bool lightReady = false;

void blinkStatus(uint8_t times) {
  for (uint8_t i = 0; i < times; i++) {
    digitalWrite(LED_PIN, HIGH);
    delay(180);
    digitalWrite(LED_PIN, LOW);
    if (i + 1 < times) delay(180);
  }
}

bool ensureWifi() {
  if (WiFi.status() == WL_CONNECTED) return true;
  Serial.println("Conectando a Wi-Fi...");
  WiFi.disconnect();
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  unsigned long started = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - started < 15000UL) {
    delay(250);
  }
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Sin Wi-Fi; se intentará en el siguiente ciclo.");
    return false;
  }
  Serial.print("Wi-Fi listo. IP del nodo: ");
  Serial.println(WiFi.localIP());
  return true;
}

void sendReading() {
  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();
  float lux = lightReady ? lightMeter.readLightLevel() : -1;

  if (isnan(temperature) || isnan(humidity) || isnan(lux) ||
      temperature < -40 || temperature > 80 || humidity < 0 || humidity > 100 ||
      lux < 0 || lux > 65535) {
    Serial.println("Lectura inválida; no se envía.");
    blinkStatus(2);
    return;
  }
  if (!ensureWifi()) { blinkStatus(2); return; }

  String payload = "{\"node_id\":\"" + String(NODE_ID) +
                   "\",\"temperature_c\":" + String(temperature, 2) +
                   ",\"humidity_pct\":" + String(humidity, 2) +
                   ",\"illuminance_lux\":" + String(lux, 2) + "}";
  HTTPClient http;
  http.setTimeout(8000);
  if (!http.begin(SERVER_URL)) {
    Serial.println("URL del servidor inválida.");
    blinkStatus(2);
    return;
  }
  http.addHeader("Content-Type", "application/json");
  if (String(NODE_KEY).length()) http.addHeader("X-EcoNodo-Key", NODE_KEY);
  int code = http.POST(payload);
  Serial.print("POST EcoNodo: ");
  Serial.println(code);
  if (code != 201) Serial.println(http.getString());
  http.end();
  blinkStatus(code == 201 ? 1 : 2);
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);
  dht.begin();
  Wire.begin(SDA_PIN, SCL_PIN);
  lightReady = lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE);
  if (!lightReady) Serial.println("BH1750 no detectado (dirección prevista 0x23).");
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  delay(2000); // DHT22: esperar antes de la primera lectura.
}

void loop() {
  unsigned long now = millis();
  if (firstCycle || now - lastCycle >= INTERVAL_MS) {
    firstCycle = false;
    lastCycle = now;
    sendReading();
  }
  delay(100);
}
