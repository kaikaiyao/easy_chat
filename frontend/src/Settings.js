// ./frontend/src/Settings.js
import React, { useState } from "react";
import "./styles/Settings.css";

const Settings = ({ settings, onSave }) => {
  const [localSettings, setLocalSettings] = useState(settings);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setLocalSettings((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    onSave(localSettings);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const importedSettings = JSON.parse(event.target.result);
          setLocalSettings(importedSettings);
        } catch (error) {
          alert("Invalid JSON file");
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="settings">
      <h3>Settings</h3>
      <div className="setting-item">
        <label>Base URL:</label>
        <input
          type="text"
          name="base_url"
          value={localSettings.base_url}
          onChange={handleChange}
          className="short-input"
        />
      </div>
      <div className="setting-item">
        <label>API Key:</label>
        <input
          type="text"
          name="api_key"
          value={localSettings.api_key}
          onChange={handleChange}
          className="short-input"
        />
      </div>
      <div className="setting-item">
        <label>Model:</label>
        <input
          type="text"
          name="model"
          value={localSettings.model}
          onChange={handleChange}
          className="short-input"
        />
      </div>
      <div className="setting-item">
        <label>Temperature:</label>
        <input
          type="number"
          step="0.1"
          name="temperature"
          value={localSettings.temperature}
          onChange={handleChange}
          className="short-input"
        />
      </div>
      <div className="setting-item">
        <label>Top P:</label>
        <input
          type="number"
          step="0.1"
          name="top_p"
          value={localSettings.top_p}
          onChange={handleChange}
          className="short-input"
        />
      </div>
      <div className="setting-item">
        <label>Import Settings:</label>
        <input type="file" accept=".json" onChange={handleFileChange} />
      </div>
      <button onClick={handleSave} className="save-button">
        Save
      </button>
    </div>
  );
};

export default Settings;