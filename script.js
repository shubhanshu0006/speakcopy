const textInput = document.getElementById("text-input");
const previewOutput = document.getElementById("preview-output");
const micButton = document.getElementById("mic-button");
const copyButton = document.getElementById("copy-button");
const clearButton = document.getElementById("clear-button");
const autoCopyCheckbox = document.getElementById("auto-copy");
const statusMessage = document.getElementById("status-message");
const charCount = document.getElementById("char-count");

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

let recognition = null;
let isListening = false;
let finalizedSpeech = "";
let lastAutoCopyAttempt = "";

function setStatus(message) {
  statusMessage.textContent = message;
}

function getCurrentText() {
  return textInput.value;
}

function updateCharCount() {
  const length = getCurrentText().length;
  charCount.textContent = `${length} character${length === 1 ? "" : "s"}`;
}

function updatePreview() {
  const currentText = getCurrentText();
  previewOutput.textContent =
    currentText || "Your text preview will appear here.";
  updateCharCount();
}

async function copyText(text, sourceLabel) {
  if (!navigator.clipboard || typeof navigator.clipboard.writeText !== "function") {
    setStatus("Clipboard API not available in this browser");
    return false;
  }

  try {
    await navigator.clipboard.writeText(text);
    lastAutoCopyAttempt = text;
    setStatus(sourceLabel === "auto" ? "Auto copied" : "Copied");

    // Small haptic hint after a successful copy on supported mobile devices.
    if (navigator.vibrate) {
      navigator.vibrate(30);
    }

    return true;
  } catch (error) {
    setStatus("Clipboard permission blocked");
    return false;
  }
}

async function syncText(nextText, options = {}) {
  textInput.value = nextText;
  updatePreview();

  if (
    options.tryAutoCopy &&
    autoCopyCheckbox.checked &&
    nextText !== lastAutoCopyAttempt
  ) {
    await copyText(nextText, "auto");
  }
}

function resetSpeechBuffer() {
  finalizedSpeech = "";
}

function createRecognition() {
  if (!SpeechRecognition) {
    micButton.disabled = true;
    setStatus("Speech recognition not supported");
    return null;
  }

  const instance = new SpeechRecognition();
  instance.continuous = true;
  instance.interimResults = true;
  instance.lang = "en-US";

  // Merge final and interim transcripts so the textarea updates live.
  instance.addEventListener("result", async (event) => {
    let interimTranscript = "";

    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index];
      const transcript = result[0].transcript;

      if (result.isFinal) {
        finalizedSpeech += transcript;
      } else {
        interimTranscript += transcript;
      }
    }

    const liveSpeech = `${finalizedSpeech}${interimTranscript}`.trim();
    await syncText(liveSpeech, { tryAutoCopy: true });
    setStatus(isListening ? "Listening..." : "Speech captured");
  });

  instance.addEventListener("start", () => {
    isListening = true;
    micButton.textContent = "Stop Listening";
    micButton.classList.add("is-listening");
    setStatus("Listening...");
  });

  instance.addEventListener("end", async () => {
    isListening = false;
    micButton.textContent = "Start Listening";
    micButton.classList.remove("is-listening");

    if (autoCopyCheckbox.checked && getCurrentText()) {
      await copyText(getCurrentText(), "auto");
    } else {
      setStatus("Stopped listening");
    }
  });

  instance.addEventListener("error", (event) => {
    isListening = false;
    micButton.textContent = "Start Listening";
    micButton.classList.remove("is-listening");

    if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      setStatus("Microphone permission blocked");
      return;
    }

    setStatus(`Speech error: ${event.error}`);
  });

  return instance;
}

textInput.addEventListener("input", async (event) => {
  resetSpeechBuffer();
  await syncText(event.target.value, { tryAutoCopy: true });
});

copyButton.addEventListener("click", async () => {
  await copyText(getCurrentText(), "manual");
});

clearButton.addEventListener("click", () => {
  textInput.value = "";
  previewOutput.textContent = "Your text preview will appear here.";
  charCount.textContent = "0 characters";
  lastAutoCopyAttempt = "";
  resetSpeechBuffer();
  setStatus("Cleared");
});

micButton.addEventListener("click", () => {
  if (!recognition) {
    setStatus("Speech recognition not supported");
    return;
  }

  if (isListening) {
    recognition.stop();
    return;
  }

  resetSpeechBuffer();

  try {
    recognition.start();
  } catch (error) {
    setStatus("Speech recognition is already starting");
  }
});

autoCopyCheckbox.addEventListener("change", async (event) => {
  if (event.target.checked) {
    setStatus("Auto copy enabled");

    // Auto copy is more reliable after a tap because clipboard access is
    // commonly restricted unless the user has interacted with the page.
    if (getCurrentText()) {
      await copyText(getCurrentText(), "auto");
    }
    return;
  }

  setStatus("Auto copy disabled");
});

recognition = createRecognition();
updatePreview();
