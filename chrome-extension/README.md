# Upwork Job Scanner Chrome Extension

A Chrome extension that automatically refreshes your Upwork job search page and notifies you with a sound when new jobs are posted.

## Features

- **Auto-Refresh**: Automatically refreshes the Upwork jobs page every 60-70 seconds (randomized to avoid detection)
- **New Job Detection**: Detects when new jobs appear on your feed
- **Sound Notifications**: Plays a sound for each new job detected
- **Custom Audio**: Upload your own notification sound
- **Simple Toggle**: Easy on/off switch to enable/disable scanning
- **Persistent State**: Remembers your settings between browser sessions

## Installation (Side-Loading)

Since this is a custom extension, you'll need to load it manually into Chrome. Follow these steps:

### Step 1: Prepare the Extension

The extension files are in the `chrome-extension` folder. Make sure you have:
- manifest.json
- popup.html
- popup.js
- content.js
- alert-sound.wav
- icons/ folder with icon files

### Step 2: Load into Chrome

1. Open Google Chrome
2. Navigate to `chrome://extensions/`
3. Enable "Developer mode" by clicking the toggle in the top-right corner
4. Click "Load unpacked" button (top-left)
5. Navigate to and select the `chrome-extension` folder
6. The extension should now appear in your extensions list

### Step 3: Pin the Extension (Optional)

1. Click the puzzle piece icon in Chrome's toolbar (Extensions)
2. Find "Upwork Job Scanner" in the list
3. Click the pin icon to keep it visible in your toolbar

## Usage

### Basic Usage

1. Navigate to your Upwork jobs page: `https://www.upwork.com/nx/find-work/`
2. Click the extension icon in your toolbar
3. Toggle the "Auto-Refresh" switch to **ON**
4. The extension will now:
   - Automatically refresh the page every 60-70 seconds
   - Scan for new jobs after each refresh
   - Play a notification sound for each new job found

### Custom Notification Sound

1. Click the extension icon
2. Under "Notification Sound", click "Choose Audio File"
3. Select any audio file from your computer (mp3, wav, ogg, etc.)
4. The new sound will be used for notifications
5. To reset to the default sound, click "Reset to Default"

### Disabling the Extension

1. Click the extension icon
2. Toggle the "Auto-Refresh" switch to **OFF**
3. The page will stop auto-refreshing

## How It Works

1. **Job Tracking**: The extension scans all job listings on the page and stores their unique IDs (`data-ev-opening_uid`)
2. **Auto-Refresh**: When enabled, the page refreshes every 60-70 seconds (randomized)
3. **New Job Detection**: After each refresh, it compares the current job list with the previous one
4. **Sound Alert**: For each new job detected, it plays the notification sound
5. **Persistent Storage**: Job IDs and settings are stored in Chrome's local storage

## Troubleshooting

### Extension doesn't appear after loading
- Make sure you selected the correct folder (the `chrome-extension` folder)
- Check that all required files are present
- Refresh the extensions page

### No sound playing
- Check your browser's sound settings
- Make sure the site is not muted (right-click the tab)
- Try uploading a different audio file
- Check browser console for errors (F12 → Console tab)

### Auto-refresh not working
- Make sure the toggle is ON
- Verify you're on the correct Upwork URL: `https://www.upwork.com/nx/find-work/`
- Check the browser console for errors

### Sounds playing on first load
- This is normal! The extension considers all jobs as "new" the first time it runs
- After the first refresh cycle, it will only alert for genuinely new jobs

## Updating the Extension

If you make any changes to the extension files:

1. Go to `chrome://extensions/`
2. Find "Upwork Job Scanner"
3. Click the refresh icon (circular arrow)
4. The extension will reload with your changes

## Removing the Extension

1. Go to `chrome://extensions/`
2. Find "Upwork Job Scanner"
3. Click "Remove"
4. Confirm the removal

## Privacy

This extension:
- Only runs on Upwork.com pages
- Stores data locally in your browser (no external servers)
- Does not collect or transmit any personal information
- Does not modify job listings or Upwork functionality

## Technical Details

- **Manifest Version**: 3
- **Permissions**: storage, activeTab
- **Host Permissions**: https://www.upwork.com/nx/find-work/*
- **Files**:
  - `manifest.json` - Extension configuration
  - `popup.html` - User interface
  - `popup.js` - UI logic
  - `content.js` - Page scanning and refresh logic
  - `alert-sound.wav` - Default notification sound

## Tips

- Keep the Upwork tab active or minimized (not closed) for the extension to work
- The extension will work even if Chrome is minimized
- You can mute the extension by turning off the toggle without removing it
- Consider using a short, pleasant sound for notifications to avoid annoyance

## Support

For issues or questions, check the browser console (F12) for error messages.

---

**Happy Job Hunting!** 🎯
