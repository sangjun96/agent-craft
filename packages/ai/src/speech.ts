const MODEL = "google/gemini-3.8-flash-tts";

export type Voice =
  | "Zephyr"
  | "Puck"
  | "Charon"
  | "Kore"
  | "Fenrir"
  | "Leda"
  | "Orus"
  | "Aoede"
  | "Callirrhoe"
  | "Autonoe"
  | "Enceladus"
  | "Iapetus"
  | "Umbriel"
  | "Algieba"
  | "Despina"
  | "Erinome"
  | "Algenib"
  | "Rasalgethi"
  | "Laomedeia"
  | "Achernar"
  | "Alnilam"
  | "Schedar"
  | "Gacrux"
  | "Pulcherrima"
  | "Achird"
  | "Zubenelgenubi"
  | "Vindemiatrix"
  | "Sadachbia"
  | "Sadaltager"
  | "Sulafat";

export type DialogueTurn = {
  voice: Voice;
  text: string;
  /** Delivery direction, e.g. "tired, yawning". Gemini reads `text` verbatim, so directions go here. */
  instructions?: string;
};

export function createSpeech(options: { apiKey: string }) {
  return {
    /** Synthesizes the turns, in order, into a single MP3. */
    async dialogue(turns: DialogueTurn[]): Promise<Uint8Array> {
      // The SDK types `input` as string only; the API also takes a turn array for multi-speaker input.
      const response = await fetch("https://openrouter.ai/api/v1/audio/speech", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: MODEL, input: turns, response_format: "mp3" }),
      });

      if (!response.ok) {
        throw new Error(`Speech request failed (${response.status}): ${await response.text()}`);
      }
      return new Uint8Array(await response.arrayBuffer());
    },
  };
}
