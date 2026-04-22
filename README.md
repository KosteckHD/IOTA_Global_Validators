# 🌍 IOTA Future Globe - Nightly Validators Dashboard

Zaawansowany, responsywny i w pełni interaktywny panel (dashboard) służący do wizualizacji oraz monitorowania węzłów i walidatorów w sieci IOTA. Aplikacja renderuje nawigowalny glob w technologii WebGL, dostarczając użytkownikowi streamowane w czasie rzeczywistym ('live') dane o kondycji sieci, statusie synchronizacji i przesyłanych blokach.

![IOTA Globe](https://img.shields.io/badge/Network-IOTA-863bff?style=flat-square&logo=iota) ![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js) ![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react) ![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38bdf8?style=flat-square&logo=tailwind-css)

---

## 🛠 Tech Stack (Stos Technologiczny)

* **Framework Główny:** [Next.js 15](https://nextjs.org/) (wykorzystujący nowy App Router)
* **Język:** TypeScript, React 19
* **Style:** [Tailwind CSS 4](https://tailwindcss.com/) (natywna implementacja modułowa v4, efekty Glassmorphism)
* **Wizualizacja WebGL 3D:** [globe.gl](https://globe.gl/) (pod maską oparty natywnie o render engine Three.js)
* **Komunikacja & Live Feed:** Fetch API, Server-Sent Events (SSE) dla endpointu /api/validators/stream/ dostarczającego asynchroniczny przepływ z RPC w czasie rzędu milisekund.
* **Ikony i Czcionki:** Fonty Google (Oxanium, Space Grotesk) dla specyficznego, nowoczesnego UX.

---

## 🚀 Architektura i Rozwiązane Problemy

Ze względu na skomplikowany interfejs graficzny najeżony animacjami napędzanymi strumieniami i rygorystyczny design - podczas kodowania wdrożyliśmy rozwiązania dla poniższych, ekstremalnych wyzwań technologicznych:

### 1. High-Frequency Streaming bloków (Pacing & Buffering queue)
Panel odbiera potężny, asynchroniczny zrzut danych sieciowych (Live Checkpoints). Zamiast dawać surowe dane bezpośrednio w stan Reacta – (co powodowało histeryczne urwane przeskoki klocków przed oczyma klienta i nieczytelność historii)  zastosowałem **Kolejkowanie asynchroniczne (UI Sync Tick Pacing)**.
* Stworzyliśmy wyizolowaną od re-renderów warstwę z buforem (lockQueueRef), który układa odebrane checkopinty. Następnie timer po stronie graficznej, używając funkcji wygładzającej  hooka useSmoothNumber z interpolacją krzywych), precyzyjnie asymiluje obiekty co 150-400ms. 
* W efekcie strumienie zdarzeń Proposal -> Finalized/Timeout spływają płynnie klockami po prawej stronie na lewo, mając całkowity czas na zgranie zaplanowanych animacji blasku .

### 2. Ekstremalna Optymalizacja Renderera 3D względem React.js
Zbudowanie pełnego, rotującego widoku Ziemi 3D z przelatującymi łukami pozycjonowanymi geograficznie było kluczem. Narząd globe.gl naturalnie stawia ogromny opór jeśli wrzuca się go po prostacku w cykl życia Reacta , gdyż przy każdej paczce danych z sieci, ekran ulegałby totalnemu ścięciu i re-inicjalizacji.
* **Złoty kompromis:** Cały obiekt globu zamknęliśmy w solidnym kontenerze opartym w 100% o stabilne ref-y (useRef). Pętle animacji React opierają się u nas teraz na zagnieżdżonym nasłuchu 

* Dodatkowo zoptymalizowaliśmy "karmiciela" obiektu licząc sygnatury różnicowe obiektów i koordynatów. Dane trafiają do Three.js przez uderzenie natywnego API biblioteki globeApiRef.current.arcsData() stricte tylko wtedy, gdy sygnatury hash faktycznie sygnalizują znaczącą różnicę topologii sieci bez wymuszania narzutu.

### 3. Responsywność RWD i "Fluid Glassmorphism"
Panel analityczny tej wagi domyślnie projektuje się tylko pod Desktop. Przystosowanie go do pełnej responsywności mobilnej – bez sztucznego obcinania użyteczności – wymagało solidnego rygoru w CSS.
* **Proposal History Bar:** Na małych oknach sztywno deklarowane luki i odległości elementów wyrzucały go poza lewą/prawą krawędź urządzenia. Zrefaktoryzowaliśmy to przy użyciu skali i dynamicznych gapów modyfikowanych za pomocą Tailwind (np. gap-0.5 md:gap-1.5) na flex-box'owym kontenerze. Podpięliśmy elementom wymuszony próg min-w-[2px], uniemożliwiając flexowi na drastyczne załamanie klocka do statusu 0 pikseli.
* **Spójny Grid & Navbar zablokowany granicach:** Wcześniej górne nagłówki i tabele ulegały nienaturalnemu "zmiażdżeniu". Przepisaliśmy domyślny margines rodzica (max-w-7xl w parze z elastycznym w-full nagłówka) unifikując układ layoutu bazowego od samej góry do dołu. Tabele otrzymały potężny protektor overflow-x-auto, dzięki czemu bez względu na to jak potężne są rozkłady IOTA adresów, panel mobilnie przechodzi w płynny Scroll poziomu wewnątrz tabeli i nigdy nie psuje kompozycyjnej osi strony głównej.

## ✨ Kluczowe funkcjonalności

1.  **3D Globe Visualizer:** Intuicyjna, obracająca i zoomowana kulą z wizualizacją przesyłu bloków na dany węzeł sieci na żywo, uwzględniającym rzuty szerokości/długości geograficznych.
2.  **Live Validators Feed:** Asynchroniczny podgląd propozycji walidatorskich - zliczanie postępu (Finalized, Timeout, Proposal) okraszone metrykami Success Rate'ów (Sieć potrafi trawić wielkie zrzuty w czasie 1400ms na batch).
3.  **Metryki Finansowe Sieci / TPS:** Monitor spalonego Gasu (IOTA), całkowitych Fees, liczby walidatorów czy realnego TPS (Transaction per Second) korelującego z czasem bloku.
4.  **Live Search / Filtry:** Automatyczna lokalizacja poszczególnych "klastrów", walidatorów i błyskawiczne przejście (Fly-To) kamery do tego konkretnego punktu globu na mapie oraz rozbudowana podstrona z tabelą wyników Network Overview.

