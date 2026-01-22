// State management
let isEnabled = false;
let refreshTimer = null;
let previousJobIds = new Set();
let audioContext = null;
let audioPrimed = false;
let audioUnlocked = false;
let initialLoadComplete = false;

// Initialize on page load
init();

function init() {
  // Load initial state from storage
  chrome.storage.local.get(['enabled', 'previousJobs', 'audioPrimed'], function(result) {
    isEnabled = result.enabled || false;
    previousJobIds = new Set(result.previousJobs || []);
    audioPrimed = result.audioPrimed || false;

    if (isEnabled) {
      startScanning();
    }

    // Aggressively prime audio on every page load
    initializeAudio();

    // Add multiple event listeners to catch user interaction
    // Using more events and not using 'once' so we keep trying
    const interactionEvents = ['click', 'mousedown', 'keydown', 'touchstart', 'scroll', 'mousemove', 'wheel', 'pointerdown'];
    interactionEvents.forEach(function(eventType) {
      document.addEventListener(eventType, unlockAudio, { passive: true, capture: true });
    });

    // Also try to unlock audio immediately on visibility change
    document.addEventListener('visibilitychange', function() {
      if (!document.hidden) {
        initializeAudio();
      }
    });

    // Set up a recurring timer to keep trying to resume audio context
    setInterval(function() {
      if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume().catch(function() {
          // Silent fail, will keep trying
        });
      }
    }, 5000); // Try every 5 seconds

    // IMPORTANT: Only scan jobs AFTER we've loaded previousJobIds from storage
    // This prevents false positives on page load
    initialLoadComplete = true;
    scanJobs();
  });
}

// Initialize audio context and attempt to resume it
function initializeAudio() {
  // Create audio context if it doesn't exist
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }

  // Try to resume audio context immediately (works if user previously interacted)
  if (audioContext.state === 'suspended') {
    audioContext.resume().then(function() {
      console.log('Audio context resumed successfully');
      audioUnlocked = true;
    }).catch(function(error) {
      console.log('Audio context resume failed:', error);
    });
  } else if (audioContext.state === 'running') {
    audioUnlocked = true;
    console.log('Audio context already running');
  }
}

// Unlock audio with user interaction
function unlockAudio() {
  // Don't return early - always try to resume if suspended
  if (audioUnlocked && audioContext && audioContext.state === 'running') {
    return; // Already unlocked and running
  }

  console.log('User interaction detected - unlocking audio');

  // Create audio context if needed
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }

  // Resume audio context
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }

  // Create and play a silent audio to unlock the audio system
  chrome.storage.local.get(['customAudio'], function(result) {
    const audioSrc = result.customAudio || chrome.runtime.getURL('alert-sound.wav');
    const audio = new Audio(audioSrc);
    audio.volume = 0.01; // Almost silent
    audio.play().then(function() {
      audioUnlocked = true;
      audioPrimed = true;
      chrome.storage.local.set({ audioPrimed: true });
      console.log('Audio unlocked and ready');

      // Remove the click prompt if it exists
      const prompt = document.getElementById('upwork-scanner-prompt');
      if (prompt) {
        prompt.remove();
      }
    }).catch(function(error) {
      console.log('Audio unlock failed:', error);
    });
  });
}

// Fallback prime audio function (called when toggle is enabled)
function primeAudio() {
  unlockAudio();
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'toggleRefresh') {
    isEnabled = request.enabled;

    if (isEnabled) {
      // Prime audio when user enables (this is a user gesture)
      primeAudio();
      startScanning();
    } else {
      stopScanning();
    }
  } else if (request.action === 'getJobDetails') {
    // Extract job details from the current page
    const jobDetails = extractJobDetails();
    sendResponse(jobDetails);
    return true; // Keep channel open for async response
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

// Play notification sound - simplified to play once
function playNotificationSounds(count) {
  console.log('New job(s) detected:', count);

  // Show visual notification immediately
  showNewJobAlert(count);

  // Play audio notification once via background service worker
  // This handles both TTS and audio playback
  try {
    chrome.runtime.sendMessage({
      action: 'playAudioNotification',
      count: 1  // Always play notification once, regardless of job count
    }, function(response) {
      if (chrome.runtime.lastError) {
        console.log('Background audio notification failed:', chrome.runtime.lastError);
      } else {
        console.log('Audio notification triggered successfully');
      }
    });
  } catch (error) {
    console.error('Error sending message to background:', error);
  }
}

// Show prominent visual alert for new jobs
function showNewJobAlert(count) {
  // Check if alert already exists
  let alert = document.getElementById('upwork-scanner-job-alert');

  if (!alert) {
    alert = document.createElement('div');
    alert.id = 'upwork-scanner-job-alert';

    // Add styles
    if (!document.getElementById('upwork-scanner-styles')) {
      const style = document.createElement('style');
      style.id = 'upwork-scanner-styles';
      style.textContent = `
        @keyframes pulseAlert {
          0%, 100% { transform: scale(1); box-shadow: 0 4px 20px rgba(20, 168, 0, 0.4); }
          50% { transform: scale(1.05); box-shadow: 0 4px 30px rgba(20, 168, 0, 0.6); }
        }
        @keyframes slideInAlert {
          from { transform: translateY(-100px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes fadeOut {
          to { opacity: 0; transform: translateY(-20px); }
        }
      `;
      document.head.appendChild(style);
    }

    alert.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(135deg, #14a800 0%, #108a00 100%);
      color: white;
      padding: 20px 30px;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 18px;
      font-weight: 600;
      cursor: pointer;
      animation: slideInAlert 0.5s ease-out, pulseAlert 2s ease-in-out infinite;
      text-align: center;
      min-width: 300px;
      border: 3px solid #fff;
    `;

    document.body.appendChild(alert);

    // Remove alert when clicked
    alert.addEventListener('click', function() {
      alert.style.animation = 'fadeOut 0.3s ease-out';
      setTimeout(function() {
        if (alert && alert.parentNode) {
          alert.remove();
        }
      }, 300);
    });
  }

  alert.innerHTML = `
    <div style="font-size: 24px; margin-bottom: 8px;">🚨 NEW JOB${count > 1 ? 'S' : ''} ALERT! 🚨</div>
    <div style="font-size: 16px; font-weight: 400;">${count} new job${count > 1 ? 's' : ''} detected!</div>
    <div style="font-size: 12px; margin-top: 8px; opacity: 0.9;">Click to dismiss</div>
  `;

  // Auto-remove after 10 seconds
  setTimeout(function() {
    if (alert && alert.parentNode) {
      alert.style.animation = 'fadeOut 0.3s ease-out';
      setTimeout(function() {
        if (alert && alert.parentNode) {
          alert.remove();
        }
      }, 300);
    }
  }, 10000);
}

// Show prompt to click on page
function showClickPrompt() {
  // Check if prompt already exists
  if (document.getElementById('upwork-scanner-prompt')) return;

  const prompt = document.createElement('div');
  prompt.id = 'upwork-scanner-prompt';
  prompt.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #ff6b00;
    color: white;
    padding: 18px 24px;
    border-radius: 10px;
    box-shadow: 0 4px 16px rgba(255, 107, 0, 0.4);
    z-index: 999998;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    animation: slideInAlert 0.5s ease-out, pulseAlert 2s ease-in-out infinite;
    border: 2px solid white;
  `;
  prompt.innerHTML = `
    <div style="font-size: 18px; margin-bottom: 4px;">🔊 Enable Audio Alerts</div>
    <div style="font-size: 12px; font-weight: 400; opacity: 0.95;">Click anywhere on the page</div>
  `;

  document.body.appendChild(prompt);

  // Remove prompt when clicked
  const removePrompt = function() {
    if (prompt && prompt.parentNode) {
      prompt.style.animation = 'fadeOut 0.3s ease-out';
      setTimeout(function() {
        if (prompt && prompt.parentNode) {
          prompt.remove();
        }
      }, 300);
    }
  };

  prompt.addEventListener('click', function() {
    unlockAudio();
    removePrompt();
  });
}

// Extract job details from the current page
function extractJobDetails() {
  try {
    let jobTitle = '';
    let budget = '';
    let description = '';

    // First, try to find the latest/first job in the job list (most recent job)
    const jobContainer = document.querySelector('[data-test="job-tile-list"]');

    if (jobContainer) {
      // Find the first job section (latest/most recent job)
      const firstJobSection = jobContainer.querySelector('section[data-ev-opening_uid]');

      if (firstJobSection) {
        // Extract title from the first job
        const titleElement = firstJobSection.querySelector('h3.job-tile-title a') ||
                           firstJobSection.querySelector('.job-tile-title a') ||
                           firstJobSection.querySelector('h3 a') ||
                           firstJobSection.querySelector('a[data-ev-label="link"]');

        if (titleElement) {
          jobTitle = titleElement.textContent.trim();
        }

        // Extract budget from the first job
        const budgetElement = firstJobSection.querySelector('[data-test="budget"]');
        if (budgetElement) {
          budget = budgetElement.textContent.trim();
        } else {
          // Try to find job type and budget together
          const jobTypeElement = firstJobSection.querySelector('[data-test="job-type"]');
          if (jobTypeElement) {
            // Get the whole line that contains job type and budget
            const parent = jobTypeElement.closest('small');
            if (parent) {
              budget = parent.textContent.trim();
            } else {
              budget = jobTypeElement.textContent.trim();
            }
          }
        }

        // Extract description from the first job
        const descElement = firstJobSection.querySelector('[data-test="job-description-text"]');
        if (descElement) {
          description = descElement.textContent.trim();
        }
      }
    }

    // If we didn't find job in the list, try to extract from job details page (when viewing a specific job)
    if (!jobTitle && !description) {
      const titleElement = document.querySelector('h4[class*="job-title"]') ||
                          document.querySelector('[data-test="job-title"]') ||
                          document.querySelector('h2.h4') ||
                          document.querySelector('.air3-card-section h4');

      if (titleElement) {
        jobTitle = titleElement.textContent.trim();
      }

      // Try to find budget on detail page
      const budgetElement = document.querySelector('[data-test="budget"]') ||
                           document.querySelector('[data-test="job-type-label"]');

      if (budgetElement) {
        budget = budgetElement.textContent.trim();
      }

      // Try to extract description from detail page
      const descriptionElement = document.querySelector('[data-test="job-description"]');

      if (descriptionElement) {
        description = descriptionElement.textContent.trim();
      }
    }

    // Format the output - only include title and description (budget is part of job type info)
    if (jobTitle || description) {
      const formattedDetails = `${jobTitle}

${description}

${budget}`;

      return {
        success: true,
        jobDetails: formattedDetails
      };
    } else {
      return {
        success: false,
        jobDetails: ''
      };
    }
  } catch (error) {
    console.error('Error extracting job details:', error);
    return {
      success: false,
      jobDetails: ''
    };
  }
}
