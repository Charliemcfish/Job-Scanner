// Get DOM elements
const enableToggle = document.getElementById('enableToggle');
const statusText = document.getElementById('status');
const audioUpload = document.getElementById('audioUpload');
const currentAudioName = document.getElementById('currentAudioName');
const resetAudio = document.getElementById('resetAudio');

// Load saved state when popup opens
chrome.storage.local.get(['enabled', 'customAudio', 'customAudioName'], function(result) {
  enableToggle.checked = result.enabled || false;
  updateStatus(result.enabled || false);

  if (result.customAudio) {
    currentAudioName.textContent = result.customAudioName || 'Custom Audio';
    resetAudio.style.display = 'inline';
  }
});

// Handle toggle switch
enableToggle.addEventListener('change', function() {
  const isEnabled = enableToggle.checked;

  chrome.storage.local.set({ enabled: isEnabled }, function() {
    updateStatus(isEnabled);

    // Notify content script of the change
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs[0] && tabs[0].url && tabs[0].url.includes('upwork.com/nx/find-work')) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'toggleRefresh',
          enabled: isEnabled
        });
      }
    });
  });
});

// Handle audio file upload
audioUpload.addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (!file) return;

  // Validate file is audio
  if (!file.type.startsWith('audio/')) {
    alert('Please select a valid audio file');
    return;
  }

  // Read file as data URL
  const reader = new FileReader();
  reader.onload = function(e) {
    const audioData = e.target.result;

    // Save to storage
    chrome.storage.local.set({
      customAudio: audioData,
      customAudioName: file.name
    }, function() {
      currentAudioName.textContent = file.name;
      resetAudio.style.display = 'inline';
    });
  };

  reader.readAsDataURL(file);
});

// Handle reset to default audio
resetAudio.addEventListener('click', function() {
  chrome.storage.local.remove(['customAudio', 'customAudioName'], function() {
    currentAudioName.textContent = 'Default (alert-sound.wav)';
    resetAudio.style.display = 'none';
    audioUpload.value = '';
  });
});

// Update status text
function updateStatus(isEnabled) {
  if (isEnabled) {
    statusText.textContent = 'Active - Scanning for new jobs';
    statusText.classList.add('active');
  } else {
    statusText.textContent = 'Disabled';
    statusText.classList.remove('active');
  }
}
