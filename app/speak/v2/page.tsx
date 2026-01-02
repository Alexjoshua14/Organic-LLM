import TTSButtonV2 from "@/components/tts/ttsButton-v2";

export default function SpeakPage() {
  return (
    <main
      className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted"
      style={{ padding: 32 }}
    >
      <section className="bg-card rounded-xl shadow-xl p-8 flex flex-col items-center gap-6 max-w-md w-full">
        <h1 className="text-2xl font-semibold text-foreground mb-2">Streaming TTS Demo</h1>
        <p className="text-muted-foreground mb-3 text-center">
          Click the button below to generate and stream speech using ElevenLabs!
        </p>
        <TTSButtonV2 text="Hello, this is a test of the streaming TTS system." />
      </section>
    </main>
  );
}
