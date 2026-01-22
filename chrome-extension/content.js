// State management
let isEnabled = false;
let refreshTimer = null;
let previousJobIds = new Set();

// Initialize on page load
init();

function init() {
  // Load initial state from storage
  chrome.storage.local.get(['enabled', 'previousJobs'], function(result) {
    isEnabled = result.enabled || false;
    previousJobIds = new Set(result.previousJobs || []);

    if (isEnabled) {
      startScanning();
    }
  });

  // Scan jobs on initial load
  scanJobs();
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'toggleRefresh') {
    isEnabled = request.enabled;

    if (isEnabled) {
      startScanning();
    } else {
      stopScanning();
    }
  }
});

// Start the auto-refresh and scanning
function startScanning() {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
  }

  scheduleNextRefresh();
}

// Stop the auto-refresh
function stopScanning() {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

// Schedule next refresh with random delay (60-70 seconds)
function scheduleNextRefresh() {
  const minDelay = 60 * 1000; // 60 seconds
  const maxDelay = 70 * 1000; // 70 seconds
  const randomDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;

  refreshTimer = setTimeout(function() {
    location.reload();
  }, randomDelay);
}

// Scan jobs on the page
function scanJobs() {
  const jobContainer = document.querySelector('[data-test="job-tile-list"]');

  if (!jobContainer) {
    console.log('Job container not found');
    return;
  }

  // Find all job sections
  const jobSections = jobContainer.querySelectorAll('section[data-ev-opening_uid]');

  if (jobSections.length === 0) {
    console.log('No jobs found on page');
    return;
  }

  // Extract job UIDs
  const currentJobIds = new Set();
  jobSections.forEach(function(section) {
    const uid = section.getAttribute('data-ev-opening_uid');
    if (uid) {
      currentJobIds.add(uid);
    }
  });

  // Find new jobs (jobs in current set but not in previous set)
  const newJobs = [];
  currentJobIds.forEach(function(jobId) {
    if (!previousJobIds.has(jobId)) {
      newJobs.push(jobId);
    }
  });

  // If there are new jobs, play sound for each one
  if (newJobs.length > 0) {
    console.log('New jobs found:', newJobs.length);
    playNotificationSounds(newJobs.length);
  }

  // Update stored job IDs
  previousJobIds = currentJobIds;
  chrome.storage.local.set({
    previousJobs: Array.from(previousJobIds)
  });
}

// Play notification sound for each new job
function playNotificationSounds(count) {
  // Load custom audio or use default
  chrome.storage.local.get(['customAudio'], function(result) {
    const audioSrc = result.customAudio || chrome.runtime.getURL('alert-sound.wav');

    // Play sound for each new job with a slight delay between plays
    for (let i = 0; i < count; i++) {
      setTimeout(function() {
        const audio = new Audio(audioSrc);
        audio.play().catch(function(error) {
          console.error('Error playing audio:', error);
        });
      }, i * 1000); // 1 second delay between each sound
    }
  });
}
