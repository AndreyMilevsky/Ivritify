const DEFAULT_FREQUENCY = 7;

const toggle = document.getElementById('enabledToggle');
const slider = document.getElementById('freqSlider');
const display = document.getElementById('freqDisplay');

chrome.storage.sync.get(['frequency', 'enabled'], (data) => {
  const freq = data.frequency || DEFAULT_FREQUENCY;
  slider.value = freq;
  display.textContent = freq;
  if (data.enabled !== undefined) {
    toggle.checked = data.enabled;
  }
});

toggle.addEventListener('change', () => {
  chrome.storage.sync.set({ enabled: toggle.checked });
});

slider.addEventListener('input', () => {
  display.textContent = slider.value;
  chrome.storage.sync.set({ frequency: parseInt(slider.value) });
});
