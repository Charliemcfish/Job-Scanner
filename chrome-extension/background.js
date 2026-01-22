// Background service worker for handling audio notifications
// This runs independently of the content script and can play audio without user gesture restrictions

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'playAudioNotification') {
    playAudioNotification(request.count);
    sendResponse({ success: true });
  }
});

// Play audio notification - simplified to play once
async function playAudioNotification(count) {
  console.log('Background: Playing notification');

  // Method 1: Play TTS (Text-to-Speech) notification
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

  // Method 2: Play audio file via offscreen document
  try {
    await playAudioViaOffscreen(1);  // Always play once
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
