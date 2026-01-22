// Offscreen document for playing audio without user gesture restrictions
// This runs in a hidden document and can play audio more reliably

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'playAudioOffscreen') {
    playAudio(request.count);
    sendResponse({ success: true });
  }
});

async function playAudio(count) {
  console.log('Offscreen: Playing audio notification');

  try {
    // Get custom audio or use default
    const result = await chrome.storage.local.get(['customAudio']);
    const audioSrc = result.customAudio || chrome.runtime.getURL('alert-sound.wav');

    // Play sound once
    const audio = new Audio(audioSrc);
    audio.volume = 1.0;

    audio.play()
      .then(() => console.log('Offscreen: Audio played successfully'))
      .catch(error => console.error('Offscreen: Audio play failed:', error));
  } catch (error) {
    console.error('Offscreen: Error playing audio:', error);
  }
}
