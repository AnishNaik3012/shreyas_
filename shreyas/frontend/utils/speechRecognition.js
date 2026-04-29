const SpeechRecognition =
  typeof window !== "undefined" &&
  (window.SpeechRecognition || window.webkitSpeechRecognition);

let recognition = null;

export function startVoiceRecognition(onResult, onEnd) {

  if (!SpeechRecognition) {
    alert("Speech recognition is not supported in this browser. Please use Chrome or Edge.");
    return;
  }

  try {

    recognition = new SpeechRecognition();

    recognition.lang = "en-IN"; // Better for Indian accent
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      console.log("?? Voice recognition started");
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      console.log("?? Transcript:", transcript);
      if (onResult) onResult(transcript);
    };

    recognition.onerror = (event) => {

      console.error("?? SpeechRecognition Error Type:", event.error);

      switch (event.error) {

        case "not-allowed":
          alert("Microphone permission denied. Please allow microphone access.");
          break;

        case "no-speech":
          console.log("No speech detected. Try speaking again.");
          break;

        case "audio-capture":
          alert("No microphone detected.");
          break;

        case "network":
          alert("Network error occurred during voice recognition.");
          break;

        default:
          console.log("Unknown speech recognition error.");
      }

      if (onEnd) onEnd();
    };

    recognition.onend = () => {
      console.log("?? Voice recognition ended");
      if (onEnd) onEnd();
    };

    recognition.start();

  } catch (err) {
    console.error("SpeechRecognition initialization failed:", err);
  }
}

export function stopVoiceRecognition() {
  if (recognition) {
    try {
      recognition.stop();
    } catch (err) {
      console.error("SpeechRecognition stop failed:", err);
    }
  }
}
