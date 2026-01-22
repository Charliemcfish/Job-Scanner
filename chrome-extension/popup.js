// Get DOM elements
const enableToggle = document.getElementById('enableToggle');
const statusText = document.getElementById('status');
const audioUpload = document.getElementById('audioUpload');
const currentAudioName = document.getElementById('currentAudioName');
const resetAudio = document.getElementById('resetAudio');
const copyPromptBtn = document.getElementById('copyPrompt');
const copyJobDetailsBtn = document.getElementById('copyJobDetails');
const promptFeedback = document.getElementById('promptFeedback');
const jobFeedback = document.getElementById('jobFeedback');

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

// Handle copy prompt button
copyPromptBtn.addEventListener('click', async function() {
  try {
    // Fetch the Proposal Prompt.txt file
    const response = await fetch(chrome.runtime.getURL('Proposal Prompt.txt'));
    const text = await response.text();

    // Copy to clipboard
    await navigator.clipboard.writeText(text);

    // Show feedback
    promptFeedback.textContent = '✓ Copied to clipboard!';
    setTimeout(() => {
      promptFeedback.textContent = '';
    }, 2000);
  } catch (error) {
    promptFeedback.textContent = '✗ Failed to copy';
    console.error('Error copying prompt:', error);
    setTimeout(() => {
      promptFeedback.textContent = '';
    }, 2000);
  }
});

// Handle copy job details button
copyJobDetailsBtn.addEventListener('click', function() {
  // Query the active tab
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (tabs[0] && tabs[0].url && tabs[0].url.includes('upwork.com')) {
      // Send message to content script to get job details
      chrome.tabs.sendMessage(tabs[0].id, { action: 'getJobDetails' }, function(response) {
        if (chrome.runtime.lastError) {
          jobFeedback.textContent = '✗ Not on a job page';
          setTimeout(() => {
            jobFeedback.textContent = '';
          }, 2000);
          return;
        }

        if (response && response.success) {
          // Copy job details to clipboard
          navigator.clipboard.writeText(response.jobDetails).then(() => {
            jobFeedback.textContent = '✓ Job details copied!';
            setTimeout(() => {
              jobFeedback.textContent = '';
            }, 2000);
          }).catch(error => {
            jobFeedback.textContent = '✗ Failed to copy';
            console.error('Error copying job details:', error);
            setTimeout(() => {
              jobFeedback.textContent = '';
            }, 2000);
          });
        } else {
          jobFeedback.textContent = '✗ No job details found';
          setTimeout(() => {
            jobFeedback.textContent = '';
          }, 2000);
        }
      });
    } else {
      jobFeedback.textContent = '✗ Not on Upwork';
      setTimeout(() => {
        jobFeedback.textContent = '';
      }, 2000);
    }
  });
});
