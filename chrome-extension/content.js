// State management
let isEnabled = false;
let refreshTimer = null;
let previousJobIds = new Set();
let audioContext = null;
let audioPrimed = false;
let audioUnlocked = false;
let pendingAudioNotifications = 0;

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
    const interactionEvents = ['click', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    interactionEvents.forEach(function(eventType) {
      document.addEventListener(eventType, unlockAudio, { once: true, passive: true });
    });
  });

  // Scan jobs on initial load
  scanJobs();
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
      // If there are pending notifications, play them now
      if (pendingAudioNotifications > 0) {
        playNotificationSounds(pendingAudioNotifications);
        pendingAudioNotifications = 0;
      }
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
  if (audioUnlocked) return;

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

      // Play any pending notifications
      if (pendingAudioNotifications > 0) {
        playNotificationSounds(pendingAudioNotifications);
        pendingAudioNotifications = 0;
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

// Play notification sound for each new job
function playNotificationSounds(count) {
  console.log('Attempting to play notification sounds for', count, 'new job(s)');

  // Show visual notification immediately regardless of audio state
  showNewJobAlert(count);

  // Try to resume audio context if suspended
  if (audioContext && audioContext.state === 'suspended') {
    audioContext.resume().then(function() {
      audioUnlocked = true;
      attemptPlayAudio(count);
    }).catch(function(error) {
      console.error('Failed to resume audio context:', error);
      storePendingNotification(count);
    });
  } else if (audioContext && audioContext.state === 'running') {
    audioUnlocked = true;
    attemptPlayAudio(count);
  } else {
    // Audio context not initialized or not unlocked
    storePendingNotification(count);
  }
}

// Store pending notification and show prompt
function storePendingNotification(count) {
  pendingAudioNotifications += count;
  console.log('Audio not ready - stored', count, 'pending notifications');
  showClickPrompt();
}

// Attempt to play audio
function attemptPlayAudio(count) {
  chrome.storage.local.get(['customAudio'], function(result) {
    const audioSrc = result.customAudio || chrome.runtime.getURL('alert-sound.wav');

    // Play sound for each new job with a slight delay between plays
    let successfulPlays = 0;
    for (let i = 0; i < count; i++) {
      setTimeout(function() {
        const audio = new Audio(audioSrc);
        audio.volume = 1.0; // Full volume for actual notifications

        audio.play().then(function() {
          successfulPlays++;
          console.log('Audio played successfully');
        }).catch(function(error) {
          console.error('Error playing audio:', error);
          // Store as pending if first play fails
          if (successfulPlays === 0 && i === 0) {
            storePendingNotification(count - i);
          }
        });
      }, i * 1000); // 1 second delay between each sound
    }
  });
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

    // Try to extract from job details page (when viewing a specific job)
    const titleElement = document.querySelector('h4[class*="job-title"]') ||
                        document.querySelector('[data-test="job-title"]') ||
                        document.querySelector('h2.h4') ||
                        document.querySelector('.air3-card-section h4') ||
                        document.querySelector('a.air3-link[data-ev-label="link"]') ||
                        document.querySelector('a[href*="/jobs/"]');

    if (titleElement) {
      jobTitle = titleElement.textContent.trim();
    }

    // Try multiple selectors for budget
    const budgetElement = document.querySelector('[data-test="budget"]') ||
                         document.querySelector('[data-test="job-type-label"]') ||
                         document.querySelector('[class*="budget"]') ||
                         Array.from(document.querySelectorAll('strong, [class*="text-body-sm"]')).find(el =>
                           el.textContent.includes('$') ||
                           el.textContent.includes('Hourly') ||
                           el.textContent.includes('Fixed')
                         );

    if (budgetElement) {
      budget = budgetElement.textContent.trim();
    } else {
      // Try to find budget in the sidebar or anywhere with $ symbol
      const allText = Array.from(document.querySelectorAll('[class*="sidebar"] *, [class*="job-detail"] *'));
      const budgetText = allText.find(el => {
        const text = el.textContent;
        return (text.includes('$') || text.includes('Hourly') || text.includes('Fixed')) &&
               text.length < 100 &&
               !text.includes('Spent') &&
               !text.includes('spent');
      });
      if (budgetText) {
        budget = budgetText.textContent.trim();
      }
    }

    // Try to extract description
    const descriptionElement = document.querySelector('[data-test="job-description"]') ||
                              document.querySelector('[class*="description"]') ||
                              document.querySelector('.air3-card-section[class*="break"] p') ||
                              document.querySelector('[class*="text-body"]');

    if (descriptionElement) {
      // Get the full description text, handling multiple paragraphs
      const descContainer = descriptionElement.closest('[class*="card-section"]') ||
                           descriptionElement.closest('[class*="description"]') ||
                           descriptionElement.parentElement;

      if (descContainer) {
        description = descContainer.textContent.trim();
      } else {
        description = descriptionElement.textContent.trim();
      }
    }

    // If we couldn't find detailed job info, try to get from job tile (for job list page)
    if (!jobTitle && !description) {
      // Try to find selected/clicked job tile
      const selectedJob = document.querySelector('section[data-ev-opening_uid].air3-token-highlight-background') ||
                         document.querySelector('section[data-ev-opening_uid]');

      if (selectedJob) {
        const titleInTile = selectedJob.querySelector('h4, h3, h2');
        if (titleInTile) {
          jobTitle = titleInTile.textContent.trim();
        }

        const descInTile = selectedJob.querySelector('[data-test="job-description-text"]') ||
                          selectedJob.querySelector('p[class*="text"]');
        if (descInTile) {
          description = descInTile.textContent.trim();
        }

        const budgetInTile = Array.from(selectedJob.querySelectorAll('strong, span')).find(el =>
          el.textContent.includes('$') ||
          el.textContent.includes('Hourly') ||
          el.textContent.includes('Fixed')
        );
        if (budgetInTile) {
          budget = budgetInTile.textContent.trim();
        }
      }
    }

    // Format the output
    if (jobTitle || description) {
      const formattedDetails = `Job Title: ${jobTitle || 'Not found'}

Budget: ${budget || 'Not found'}

Job Description:
${description || 'Not found'}`;

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
