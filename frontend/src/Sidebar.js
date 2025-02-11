// ./frontend/src/Sidebar.js
import React, { useState } from "react";
import "./styles/Sidebar.css";
import { FaEdit, FaTrash } from "react-icons/fa";

const Sidebar = ({
  conversations,
  currentConversation,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onRenameConversation,
  loading,
  setCurrentConversation,
  loadConversations,
}) => {
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");

  const handleRename = (conv) => {
    if (editValue.trim()) {
      onRenameConversation(conv.id, editValue);
    }
    setEditingId(null);
    setEditValue("");
  };

  const handleDelete = (conversationId) => {
    if (window.confirm("Are you sure you want to delete this chat?")) {
      onDeleteConversation(conversationId);
    }
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h1 className="app-title">EasyChat</h1>
      </div>

      <div className="conversation-list">
        {loading ? (
          <div className="loading">Loading conversations...</div>
        ) : (
          <ul>
            {conversations.map((conv) => (
              <li
                key={conv.id}
                className={`conversation-item ${
                  conv.id === currentConversation ? "active" : ""
                }`}
              >
                <div
                  className="conv-content"
                  onClick={() => onSelectConversation(conv.id)}
                >
                  {editingId === conv.id ? (
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => handleRename(conv)}
                      onKeyPress={(e) =>
                        e.key === "Enter" && handleRename(conv)
                      }
                      autoFocus
                    />
                  ) : (
                    <>
                      <div className="conv-title">{conv.title}</div>
                      <div className="conv-time">
                        {new Date(conv.timestamp).toLocaleString()}
                      </div>
                    </>
                  )}
                </div>
                <div className="conv-actions">
                  <button
                    className="icon-button edit-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingId(conv.id);
                      setEditValue(conv.title);
                    }}
                  >
                    <FaEdit />
                  </button>
                  <button
                    className="icon-button delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(conv.id);
                    }}
                  >
                    <FaTrash />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="sidebar-footer">
        <button onClick={onNewConversation} className="new-chat-btn">
          + New Chat
        </button>
        <button
          className="danger-button"
          onClick={() => {
            if (
              window.confirm(
                "Are you sure you want to delete ALL chats? This cannot be undone!"
              )
            ) {
              fetch("/api/conversations/all", { method: "DELETE" }).then(() => {
                setCurrentConversation(null);
                loadConversations();
              });
            }
          }}
        >
          <FaTrash /> Delete All Chats
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
