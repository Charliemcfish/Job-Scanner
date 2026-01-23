// Get DOM elements
const enableToggle = document.getElementById('enableToggle');
const statusText = document.getElementById('status');
const copyPromptBtn = document.getElementById('copyPrompt');
const copyJobDetailsBtn = document.getElementById('copyJobDetails');
const generateProposalBtn = document.getElementById('generateProposal');
const promptFeedback = document.getElementById('promptFeedback');
const jobFeedback = document.getElementById('jobFeedback');
const generateFeedback = document.getElementById('generateFeedback');

// Load saved state when popup opens
chrome.storage.local.get(['enabled'], function(result) {
  enableToggle.checked = result.enabled || false;
  updateStatus(result.enabled || false);
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

// Handle generate proposal button
generateProposalBtn.addEventListener('click', async function() {
  try {
    // First, fetch the prompt text
    const response = await fetch(chrome.runtime.getURL('Proposal Prompt.txt'));
    const promptText = await response.text();

    // Then, get job details from the active tab
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs[0] && tabs[0].url && tabs[0].url.includes('upwork.com')) {
        // Send message to content script to get job details
        chrome.tabs.sendMessage(tabs[0].id, { action: 'getJobDetails' }, function(jobResponse) {
          if (chrome.runtime.lastError) {
            generateFeedback.textContent = '✗ Not on a job page';
            setTimeout(() => {
              generateFeedback.textContent = '';
            }, 2000);
            return;
          }

          if (jobResponse && jobResponse.success) {
            // Replace [INSERT JOB DESCRIPTION HERE] with actual job details
            const generatedProposal = promptText.replace('[INSERT JOB DESCRIPTION HERE]', jobResponse.jobDetails);

            // Copy to clipboard
            navigator.clipboard.writeText(generatedProposal).then(() => {
              generateFeedback.textContent = '✓ Proposal generated!';
              setTimeout(() => {
                generateFeedback.textContent = '';
              }, 2000);
            }).catch(error => {
              generateFeedback.textContent = '✗ Failed to copy';
              console.error('Error copying generated proposal:', error);
              setTimeout(() => {
                generateFeedback.textContent = '';
              }, 2000);
            });
          } else {
            generateFeedback.textContent = '✗ No job details found';
            setTimeout(() => {
              generateFeedback.textContent = '';
            }, 2000);
          }
        });
      } else {
        generateFeedback.textContent = '✗ Not on Upwork';
        setTimeout(() => {
          generateFeedback.textContent = '';
        }, 2000);
      }
    });
  } catch (error) {
    generateFeedback.textContent = '✗ Failed to generate';
    console.error('Error generating proposal:', error);
    setTimeout(() => {
      generateFeedback.textContent = '';
    }, 2000);
  }
});
