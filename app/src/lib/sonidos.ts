// Sonidos sintetizados (sin archivos de audio), copiados del formulario de la landing de Código MaestrIA
// (landing-maestria/src/util.js): mismas frecuencias, mismo desbloqueo para iOS y el silencio se recuerda.

const CLAVE = "ccp-sonido";
let ctx: AudioContext | null = null;
let silencio = false;
let iniciado = false;

function leerSilencio() {
  try { return localStorage.getItem(CLAVE) === "off"; } catch { return false; }
}

function contexto(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try { ctx = new Ctor(); } catch { ctx = null; }
  return ctx;
}

/** iOS solo abre el audio dentro de un gesto y tras reproducir algo, aunque sea mudo. */
function desbloquear() {
  const audio = contexto();
  if (!audio) return;
  const cebar = () => {
    try {
      const src = audio.createBufferSource();
      src.buffer = audio.createBuffer(1, 1, 22050);
      src.connect(audio.destination);
      src.start(0);
    } catch { /* sin audio: la página sigue igual */ }
    if (audio.state === "running") {
      document.removeEventListener("pointerdown", desbloquear, true);
      document.removeEventListener("touchstart", desbloquear, true);
    }
  };
  if (audio.state === "suspended") audio.resume().then(cebar).catch(() => {});
  else cebar();
}

/** Se llama una vez al montar la pantalla que usa sonidos. */
export function iniciarSonidos() {
  if (iniciado || typeof window === "undefined") return;
  iniciado = true;
  silencio = leerSilencio();
  document.addEventListener("pointerdown", desbloquear, true);
  document.addEventListener("touchstart", desbloquear, true);
}

function tono(freq: number, dur: number, tipo: OscillatorType = "sine", vol = 0.12, retraso = 0) {
  if (silencio) return;
  const audio = contexto();
  if (!audio || audio.state !== "running") return;
  try {
    const inicio = audio.currentTime + retraso;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = tipo;
    osc.frequency.setValueAtTime(freq, inicio);
    gain.gain.setValueAtTime(0, inicio);
    gain.gain.linearRampToValueAtTime(vol, inicio + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, inicio + dur);
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start(inicio);
    osc.stop(inicio + dur + 0.03);
  } catch { /* un fallo de audio nunca bloquea el formulario */ }
}

export const Sfx = {
  click: () => tono(700, 0.06, "sine", 0.1),
  select: () => { tono(540, 0.07, "triangle", 0.14); tono(900, 0.07, "sine", 0.12, 0.035); },
  advance: () => { tono(420, 0.09, "sine", 0.11); tono(640, 0.09, "sine", 0.11, 0.06); tono(860, 0.12, "sine", 0.12, 0.12); },
  success: () => { [523.25, 659.25, 784, 1046.5].forEach((f, i) => tono(f, 0.22, "sine", 0.14, i * 0.09)); },
  enSilencio: () => silencio,
  alternar: () => {
    silencio = !silencio;
    try { localStorage.setItem(CLAVE, silencio ? "off" : "on"); } catch { /* sin almacenamiento: solo esta sesión */ }
    if (!silencio) { desbloquear(); tono(700, 0.06, "sine", 0.1); }
    return silencio;
  },
};
