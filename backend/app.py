from flask import Flask, request, jsonify, send_from_directory, Response
import os
import json
import time
import uuid
from pathlib import Path
from openai import OpenAI
import sys
import logging
import platform

logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__, static_folder=str(Path(__file__).parent.parent / 'frontend/build'), static_url_path="/")

# Cross-platform path handling
DATA_DIR = Path(__file__).parent / 'data'
DATA_DIR.mkdir(exist_ok=True, parents=True)  # parents=True for nested directory creation

def load_conversations():
    conversations = []
    for file in DATA_DIR.glob('*.json'):
        try:
            with open(file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                conversations.append({
                    "id": data["id"],
                    "title": data["title"],
                    "timestamp": data["timestamp"],
                    "messages": data["messages"]
                })
        except Exception as e:
            logger.error(f"Error loading {file}: {str(e)}")
    return sorted(conversations, key=lambda x: x["timestamp"], reverse=True)


@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.json
    conversation_id = data.get("conversation_id")
    prompt = data.get("message")
    base_url = data.get("base_url", "https://api.openai.com/v1")
    api_key = data.get("api_key")
    model = data.get("model", "gpt-3.5-turbo")
    temperature = data.get("temperature", 0.6)
    top_p = data.get("top_p", 0.7)
    
    if not prompt or not conversation_id or not api_key:
        return jsonify({"error": "Missing required parameters"}), 400

    path = DATA_DIR / f"{conversation_id}.json"
    if path.exists():
        try:
            with open(path, 'r', encoding='utf-8') as f:
                conversation = json.load(f)
        except Exception as e:
            logger.error(f"Error loading conversation: {str(e)}")
            return jsonify({"error": "Failed to load conversation"}), 500
    else:
        conversation = {
            "id": conversation_id,
            "title": "New Chat",
            "timestamp": int(time.time() * 1000),
            "messages": []
        }

    user_message = {"role": "user", "content": prompt}
    conversation["messages"].append(user_message)
    
    if len(conversation["messages"]) == 1:
        conversation["title"] = prompt[:20] + "..." if len(prompt) > 5 else prompt
    
    save_conversation(conversation)

    def generate():
        buffer = ""
        in_think_block = False
        current_think = ""
        assistant_message = None
        # Yield the user event
        yield f"data: {json.dumps({'type': 'user', 'content': prompt})}\n\n"
        # If this is the first user message, immediately yield a title update event
        if len(conversation["messages"]) == 1:
            yield f"data: {json.dumps({'type': 'title_update', 'content': conversation['title']})}\n\n"
        # Prepare messages for the API call (ignoring any 'thinking' messages)
        messages_for_api = []
        for msg in conversation["messages"]:
            if msg.get("role") in ["user", "assistant"]:
                if msg.get("type") != "thinking":
                    messages_for_api.append({
                        "role": msg["role"],
                        "content": msg["content"]
                    })
        # Create a new client instance using the provided API settings
        client = OpenAI(
            base_url=base_url,
            api_key=api_key,
        )
        # Start the completion stream
        completion = client.chat.completions.create(
            model=model,
            messages=messages_for_api,
            temperature=temperature,
            top_p=top_p,
            stream=True
        )
        try:
            for chunk in completion:
                if not chunk.choices:
                    continue
                delta = chunk.choices[0].delta
                if not hasattr(delta, 'content') or delta.content is None:
                    continue
                content = delta.content
                buffer += content
                while True:
                    if not in_think_block and '<think>' in buffer.lower():
                        start_idx = buffer.lower().index('<think>')
                        pre_content = buffer[:start_idx]
                        if pre_content.strip():
                            yield f"data: {json.dumps({'type': 'assistant', 'content': pre_content})}\n\n"
                        buffer = buffer[start_idx + len('<think>'):]
                        in_think_block = True
                        yield f"data: {json.dumps({'type': 'think_start'})}\n\n"
                    elif in_think_block and '</think>' in buffer.lower():
                        end_idx = buffer.lower().index('</think>')
                        think_content = buffer[:end_idx]
                        if think_content.strip():
                            yield f"data: {json.dumps({'type': 'think', 'content': think_content})}\n\n"
                            current_think += think_content
                        buffer = buffer[end_idx + len('</think>'):]
                        in_think_block = False
                        yield f"data: {json.dumps({'type': 'think_end'})}\n\n"
                        conversation["messages"].append({
                            "role": "assistant",
                            "type": "thinking",
                            "content": current_think
                        })
                        save_conversation(conversation)
                        current_think = ""
                    else:
                        break
                if in_think_block:
                    yield f"data: {json.dumps({'type': 'think', 'content': buffer})}\n\n"
                    current_think += buffer
                    buffer = ""
                elif buffer.strip():
                    if not assistant_message:
                        assistant_message = {
                            "role": "assistant",
                            "type": "final",
                            "content": buffer,
                            "id": str(uuid.uuid4()),
                            "loading": True
                        }
                        conversation["messages"].append(assistant_message)
                    else:
                        assistant_message["content"] += buffer
                    yield f"data: {json.dumps({'type': 'assistant', 'content': buffer})}\n\n"
                    save_conversation(conversation)
                    buffer = ""
            # Final save after completion
            save_conversation(conversation)
        except Exception as e:
            if "incomplete chunked read" in str(e):
                logger.warning("Incomplete chunked read encountered, finishing stream gracefully")
            else:
                logger.error(f"Error during streaming: {str(e)}")
                yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"
        finally:
            yield "data: [DONE]\n\n"
    return Response(
        generate(),
        mimetype="text/event-stream",
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no',
            'Connection': 'keep-alive',
            'Content-Type': 'text/event-stream'
        }
    )


def save_conversation(data):
    path = DATA_DIR / f"{data['id']}.json"
    try:
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.error(f"Error saving conversation: {str(e)}")
        raise


@app.route("/api/conversations", methods=["GET"])
def get_conversations():
    return jsonify(load_conversations())


@app.route("/api/conversations/<conversation_id>", methods=["GET"])
def get_conversation(conversation_id):
    conversation = None
    conversations = load_conversations()
    for conv in conversations:
        if conv["id"] == conversation_id:
            conversation = conv
            break

    if conversation:
        return jsonify(conversation)
    return jsonify({"error": "Conversation not found"}), 404


@app.route("/api/conversations/<conversation_id>", methods=["DELETE"])
def delete_conversation(conversation_id):
    path = DATA_DIR / f"{conversation_id}.json"
    if path.exists():
        path.unlink()
    return jsonify({"status": "success"})


@app.route("/api/conversations/<conversation_id>/rename", methods=["PUT"])
def rename_conversation(conversation_id):
    new_title = request.json.get("title")
    path = DATA_DIR / f"{conversation_id}.json"

    if path.exists():
        with open(path, 'r') as f:
            data = json.load(f)
        data["title"] = new_title
        with open(path, 'w') as f:
            json.dump(data, f)
        return jsonify({"status": "success"})
    return jsonify({"error": "Conversation not found"}), 404


@app.route("/api/conversations/new", methods=["POST"])
def new_conversation():
    conversation_id = str(uuid.uuid4())
    new_conv = {
        "id": conversation_id,
        "title": "New Chat",  # Default title set to "New Chat"
        "timestamp": int(time.time() * 1000),
        "messages": []
    }
    save_conversation(new_conv)
    return jsonify(new_conv)


@app.route("/api/conversations/all", methods=["DELETE"])
def delete_all_conversations():
    try:
        for file in DATA_DIR.glob('*.json'):
            file.unlink()
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/conversations/<conversation_id>/edit_last_message", methods=["PUT"])
def edit_last_message(conversation_id):
    new_message = request.json.get("message")
    path = DATA_DIR / f"{conversation_id}.json"

    if path.exists():
        with open(path, 'r') as f:
            data = json.load(f)
        if data["messages"] and data["messages"][-1]["role"] == "user":
            data["messages"][-1]["content"] = new_message
            with open(path, 'w') as f:
                json.dump(data, f)
            return jsonify({"status": "success"})
        else:
            return jsonify({"error": "No user message to edit"}), 400
    return jsonify({"error": "Conversation not found"}), 404


@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve(path):
    static_path = Path(app.static_folder) / path
    if static_path.exists() and static_path.is_file():
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, "index.html")


if __name__ == "__main__":
    # Cross-platform server setup
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)