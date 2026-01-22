// Background service worker for handling audio notifications
// This runs independently of the content script and can play audio without user gesture restrictions

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'playAudioNotification') {
    playAudioNotification(request.count);
    sendResponse({ success: true });
  }
});

// Play audio notification using multiple methods for maximum reliability
async function playAudioNotification(count) {
  console.log('Background: Playing notification for', count, 'new job(s)');

  // Method 1: Try chrome.tts API first (doesn't require user gesture)
  try {
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        chrome.tts.speak('New job alert!', {
          rate: 1.5,
          pitch: 1.2,
          volume: 1.0
        });
      }, i * 1000);
    }
    console.log('Background: TTS notification played successfully');
  } catch (error) {
    console.error('Background: TTS notification failed:', error);
  }

  // Method 2: Try to play audio file via offscreen document (for Manifest V3)
  // This is more reliable than content script audio
  try {
    await playAudioViaOffscreen(count);
  } catch (error) {
    console.error('Background: Offscreen audio failed:', error);
  }
}

// Play audio using offscreen document (bypasses some autoplay restrictions)
async function playAudioViaOffscreen(count) {
  // Check if we can create offscreen documents
  if (!chrome.offscreen) {
    console.log('Background: Offscreen API not available');
    return;
  }

  try {
    // Create offscreen document if it doesn't exist
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT']
    });

    if (existingContexts.length === 0) {
      await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['AUDIO_PLAYBACK'],
        justification: 'Play notification sound for new job alerts'
      });
    }

    // Send message to offscreen document to play audio
    await chrome.runtime.sendMessage({
      action: 'playAudioOffscreen',
      count: count
    });

    console.log('Background: Offscreen audio played successfully');
  } catch (error) {
    console.error('Background: Error with offscreen audio:', error);
  }
}
