# IOTA Future Globe - Nightly Validators Dashboard

Czytelny dashboard do monitorowania walidatorow IOTA z widokiem 3D globu oraz odswiezaniem danych na zywo.

## Co to jest

Projekt pokazuje stan sieci IOTA w formie:
- interaktywnego globu 3D (wezly i polaczenia),
- live feedu checkpointow i statusow,
- tabeli walidatorow z podstawowymi metrykami,
- podstron pomocniczych (np. walidatorzy, wykresy, staking).

Aplikacja jest zbudowana na Next.js (App Router), a dane sa pobierane po stronie serwera przez endpointy API w katalogu app/api.

## Stack technologiczny

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS 4
- globe.gl (WebGL / Three.js)
- Zod (walidacja konfiguracji)
- SSE (Server-Sent Events) dla strumienia live

## Jak dziala aplikacja

1. Frontend renderuje widok dashboardu oraz glob 3D.
2. Endpointy API (Next.js Route Handlers) pobieraja dane z RPC IOTA.
3. Endpoint streamu wysyla aktualizacje przez SSE.
4. UI odswieza widok i animacje bez pelnego przeladowania strony.

Wazne: glowna aplikacja nie wymaga osobnego uruchamiania serwera z katalogu server. W codziennej pracy wystarczy uruchomic Next.js.

## Wymagania

- Node.js 20+ (zalecane LTS)
- npm 10+ (lub nowszy)
- Dostep do internetu (RPC IOTA + uslugi geolokalizacji)

## Szybki start (lokalnie)

1. Zainstaluj zaleznosci:

```bash
npm install
```

2. Uruchom tryb developerski:

```bash
npm run dev
```

3. Otworz w przegladarce:

```text
http://localhost:3000
```

## Konfiguracja zmiennych srodowiskowych

Projekt czyta konfiguracje z pliku .env (lub .env.local). Minimalna konfiguracja moze wygladac tak:

```env
IOTA_RPC_URL=...
IOTA_TESTNET_RPC_URL=...
IOTA_RPC_METHOD=...
IOTA_CHECKPOINT_METHOD=....
VALIDATORS_REFRESH_MS=5000
CHECKPOINT_REFRESH_MS=1000
CHECKPOINT_HISTORY_SIZE=60
```

Opcjonalnie (zalecane w produkcji, jesli RPC wymaga autoryzacji):

```env
IOTA_RPC_AUTH_HEADER=Authorization
IOTA_RPC_AUTH_TOKEN=Bearer <twoj_token>
```

Uwagi:
- w production brak danych autoryzacyjnych moze zablokowac wywolania RPC,
- zbyt niskie interwaly odswiezania zwiekszaja obciazenie sieci i API.

## Uruchomienie produkcyjne

1. Zbuduj aplikacje:

```bash
npm run build
```

2. Uruchom serwer produkcyjny:

```bash
npm run start
```

Domyslnie aplikacja rusza pod adresem:

```text
http://localhost:3000
```

## Przydatne komendy

```bash
npm run dev      # tryb developerski
npm run build    # build produkcyjny
npm run start    # start po buildzie
npm run lint     # lint projektu
```

## Gdzie sa najwazniejsze elementy

- app/page.tsx - glowny dashboard z globem
- app/api/validators/route.ts - jednorazowe pobranie danych
- app/api/validators/stream/route.ts - stream SSE na zywo
- lib/validators.ts - logika pobierania i agregacji danych RPC
- app/validators/page.tsx - widok tabeli walidatorow

## Rozwiazywanie problemow

- Brak danych na ekranie:
	- sprawdz, czy endpoint RPC odpowiada,
	- sprawdz zmienne srodowiskowe,
	- sprawdz logi w terminalu po npm run dev.

- Glob sie nie renderuje:
	- odswiez strone po starcie serwera,
	- sprawdz bledy w konsoli przegladarki,
	- upewnij sie, ze masz wlaczone WebGL w przegladarce.

- Wolne odswiezanie:
	- zmniejsz VALIDATORS_REFRESH_MS i CHECKPOINT_REFRESH_MS ostroznie,
	- pamietaj, ze nizsze wartosci to wiekszy ruch do RPC.

## Status

Projekt jest aktywnie rozwijany jako dashboard do monitoringu sieci IOTA i jest zadaniem rekrutacyjnym dla Frontend Developera.

