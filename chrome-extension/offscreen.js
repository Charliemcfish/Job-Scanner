// Offscreen document for playing audio without user gesture restrictions
// This runs in a hidden document and can play audio more reliably

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'playAudioOffscreen') {
    playAudio(request.count);
    sendResponse({ success: true });
  }
});

async function playAudio(count) {
  console.log('Offscreen: Playing audio for', count, 'new job(s)');

  try {
    // Get custom audio or use default
    const result = await chrome.storage.local.get(['customAudio']);
    const audioSrc = result.customAudio || chrome.runtime.getURL('alert-sound.wav');

    // Play sound for each new job with a delay between plays
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        const audio = new Audio(audioSrc);
        audio.volume = 1.0;

        audio.play()
          .then(() => console.log('Offscreen: Audio played successfully'))
          .catch(error => console.error('Offscreen: Audio play failed:', error));
      }, i * 1000);
    }
  } catch (error) {
    console.error('Offscreen: Error playing audio:', error);
  }
}
