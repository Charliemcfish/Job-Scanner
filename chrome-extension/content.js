// State management
let isEnabled = false;
let refreshTimer = null;
let previousJobIds = new Set();
let initialLoadComplete = false;

// Check if we're on the find-work page (the only page that should auto-refresh)
const FIND_WORK_URL = 'https://www.upwork.com/nx/find-work';
function isOnFindWorkPage() {
  return window.location.href.startsWith(FIND_WORK_URL);
}

// Initialize on page load
init();

function init() {
  // Only run refresh/scanning logic on the find-work page
  if (!isOnFindWorkPage()) {
    return;
  }

  // Load initial state from storage
  chrome.storage.local.get(['enabled', 'previousJobs'], function(result) {
    isEnabled = result.enabled || false;
    previousJobIds = new Set(result.previousJobs || []);

    if (isEnabled) {
      startScanning();
    }

    // IMPORTANT: Only scan jobs AFTER we've loaded previousJobIds from storage
    // This prevents false positives on page load
    initialLoadComplete = true;
    scanJobs();
  });
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'toggleRefresh') {
    // Only handle refresh toggle on find-work page
    if (!isOnFindWorkPage()) {
      return;
    }

    isEnabled = request.enabled;

    if (isEnabled) {
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

  // Store whether we had previous jobs (to prevent false positives on first scan)
  const hadPreviousJobs = previousJobIds.size > 0;

  // Find new jobs (jobs in current set but not in previous set)
  const newJobs = [];
  currentJobIds.forEach(function(jobId) {
    if (!previousJobIds.has(jobId)) {
      newJobs.push(jobId);
    }
  });

  // Only trigger notification if:
  // 1. There are new jobs AND
  // 2. We had previous jobs (not the first scan/page load)
  if (newJobs.length > 0 && hadPreviousJobs) {
    console.log('New jobs found:', newJobs.length);
    playNotificationSounds(newJobs.length);
  } else if (newJobs.length > 0 && !hadPreviousJobs) {
    console.log('Initial scan - found', currentJobIds.size, 'jobs (no notification)');
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
