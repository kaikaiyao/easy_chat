import React, { useState, useEffect } from "react";
import ChatWindow from "./ChatWindow";
import Sidebar from "./Sidebar";
import Settings from "./Settings";
import "./styles/App.css";

function App() {
    const [currentConversation, setCurrentConversation] = useState(null);
    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [controller, setController] = useState(null);
    const [settings, setSettings] = useState({
        base_url: "https://api.openai.com/v1",
        api_key: "",
        model: "gpt-3.5-turbo",
        temperature: 0.6,
        top_p: 0.7,
    });

    const loadConversations = () => {
        fetch("/api/conversations")
            .then((res) => res.json())
            .then((data) => {
                setConversations(data);
                setLoading(false);
            });
    };

    useEffect(() => {
        loadConversations();
    }, []);

    const handleNewConversation = () => {
        fetch("/api/conversations/new", { method: "POST" })
            .then((res) => res.json())
            .then((data) => {
                setCurrentConversation(data.id);
                loadConversations();
            });
    };

    const handleDeleteConversation = (conversationId) => {
        fetch(`/api/conversations/${conversationId}`, { method: "DELETE" })
            .then(() => {
                if (currentConversation === conversationId) {
                    setCurrentConversation(null);
                }
                loadConversations();
            });
    };

    const handleRenameConversation = (conversationId, newTitle) => {
        fetch(`/api/conversations/${conversationId}/rename`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: newTitle })
        }).then(loadConversations);
    };

    const handleSaveSettings = (newSettings) => {
        setSettings(newSettings);
    };

    return (
        <div className="app">
            <Sidebar
                conversations={conversations}
                currentConversation={currentConversation}
                onSelectConversation={setCurrentConversation}
                onNewConversation={handleNewConversation}
                onDeleteConversation={handleDeleteConversation}
                onRenameConversation={handleRenameConversation}
                loading={loading}
                setCurrentConversation={setCurrentConversation}
                loadConversations={loadConversations}
            />
            {currentConversation ? (
                <ChatWindow
                    key={currentConversation}
                    conversationId={currentConversation}
                    isProcessing={isProcessing}
                    setIsProcessing={setIsProcessing}
                    controller={controller}
                    setController={setController}
                    settings={settings}
                    loadConversations={loadConversations}
                />
            ) : (
                <div className="empty-state">
                    <h2>Welcome to EasyChat</h2>
                    <p>Select a conversation or start a new one</p>
                </div>
            )}
            <Settings settings={settings} onSave={handleSaveSettings} />
        </div>
    );
}

export default App;
