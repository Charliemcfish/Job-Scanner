// Background service worker for handling TTS notifications
// This runs independently of the content script

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'playAudioNotification') {
    playTTSNotification();
    sendResponse({ success: true });
  }
});

// Play TTS notification
function playTTSNotification() {
  console.log('Background: Playing TTS notification');

  try {
    chrome.tts.speak('New job alert!', {
      rate: 1.5,
      pitch: 1.2,
      volume: 1.0
    });
    console.log('Background: TTS notification played successfully');
  } catch (error) {
    console.error('Background: TTS notification failed:', error);
  }
}
