// State management
let isEnabled = false;
let refreshTimer = null;
let previousJobIds = new Set();
let audioContext = null;
let audioPrimed = false;

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

    // If audio not primed yet, add click listener
    if (!audioPrimed) {
      document.addEventListener('click', primeAudio, { once: true });
    } else {
      console.log('Audio already primed from previous session');
    }
  });

  // Scan jobs on initial load
  scanJobs();
}

// Prime audio for autoplay
function primeAudio() {
  if (audioPrimed) return;

  // Create audio context and unlock it
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }

  // Resume audio context (required for some browsers)
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }

  // Create and play a silent audio to prime the system
  chrome.storage.local.get(['customAudio'], function(result) {
    const audioSrc = result.customAudio || chrome.runtime.getURL('alert-sound.wav');
    const audio = new Audio(audioSrc);
    audio.volume = 0.01; // Almost silent
    audio.play().then(function() {
      audioPrimed = true;
      // Save primed state so it persists across page refreshes
      chrome.storage.local.set({ audioPrimed: true });
      console.log('Audio primed and ready');
    }).catch(function(error) {
      console.log('Audio priming failed:', error);
    });
  });
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
  // Ensure audio is primed
  if (!audioPrimed) {
    console.log('Audio not primed yet - click anywhere on the page to enable sounds');
    showClickPrompt();
    return;
  }

  // Resume audio context if suspended
  if (audioContext && audioContext.state === 'suspended') {
    audioContext.resume();
  }

  // Load custom audio or use default
  chrome.storage.local.get(['customAudio'], function(result) {
    const audioSrc = result.customAudio || chrome.runtime.getURL('alert-sound.wav');

    // Play sound for each new job with a slight delay between plays
    for (let i = 0; i < count; i++) {
      setTimeout(function() {
        const audio = new Audio(audioSrc);
        audio.volume = 1.0; // Full volume for actual notifications

        audio.play().catch(function(error) {
          console.error('Error playing audio:', error);
          console.log('Try clicking anywhere on the page to enable sounds');
          showClickPrompt();
        });
      }, i * 1000); // 1 second delay between each sound
    }
  });
}

// Show prompt to click on page
function showClickPrompt() {
  // Check if prompt already exists
  if (document.getElementById('upwork-scanner-prompt')) return;

  const prompt = document.createElement('div');
  prompt.id = 'upwork-scanner-prompt';
  prompt.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #14a800;
    color: white;
    padding: 15px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    animation: slideIn 0.3s ease-out;
  `;
  prompt.textContent = '🔔 Click anywhere to enable job notifications';

  // Add animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);

  document.body.appendChild(prompt);

  // Remove prompt when clicked or after 10 seconds
  const removePrompt = function() {
    if (prompt && prompt.parentNode) {
      prompt.style.animation = 'slideIn 0.3s ease-out reverse';
      setTimeout(function() {
        if (prompt && prompt.parentNode) {
          prompt.parentNode.removeChild(prompt);
        }
      }, 300);
    }
  };

  prompt.addEventListener('click', removePrompt);
  setTimeout(removePrompt, 10000);
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
                        document.querySelector('.air3-card-section h4');

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
