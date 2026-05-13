import os
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__, static_folder="../frontend", static_url_path="")
CORS(app)

VAPI_API_KEY = os.getenv("VAPI_API_KEY")
VAPI_BASE_URL = "https://api.vapi.ai"

HEADERS = {
    "Authorization": f"Bearer {VAPI_API_KEY}",
    "Content-Type": "application/json"
}

def extract_reservation_with_gemini(transcript):
    """
    Uses Gemini 1.5 Flash to extract structured reservation data from transcripts.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    base_url = os.getenv("GEMINI_URL")
    url = f"{base_url}?key={api_key}"
    
    prompt = f"""
    You are a professional hotel reservation data extractor. Analyze the transcript below and extract the reservation details into a clean JSON object.
    
    Required Fields:
    - guestName (Full name of the guest)
    - checkInDate (The requested check-in date)
    - checkOutDate (The requested check-out date)
    - roomType (e.g. King, Deluxe, Suite, Twin)
    - guests (Total number of people)
    - extras (Any special requests like Spa, Breakfast, Late checkout, etc. List them or say "None")
    
    Transcript:
    {transcript}
    
    Return ONLY valid JSON. No preamble or markdown. If a value is unknown, use "TBD".
    """
    
    payload = {
        "contents": [{
            "parts": [{"text": prompt}]
        }]
    }
    
    try:
        response = requests.post(url, json=payload)
        res_json = response.json()
        if 'candidates' in res_json:
            text = res_json['candidates'][0]['content']['parts'][0]['text']
            # Clean up possible markdown code blocks
            text = text.replace('```json', '').replace('```', '').strip()
            import json
            return json.loads(text)
    except Exception as e:
        print(f"Gemini Extraction Error: {e}")
    return None

@app.route("/")
def index():
    return app.send_static_file("index.html")

# In-memory storage for reservations
RESERVATIONS = []

MOCK_STATS = {
    "reservations_today": 0,
    "housekeeping_requests": 5,
    "feedback_calls_made": 8,
    "active_calls": 0
}

ASSISTANT_TEMPLATES = {
    "reservation": {
        "name": "Hotel Reservation Agent",
        "firstMessage": "Hello! Thank you for calling our hotel. How can I assist you with your reservation today?",
        "model": {
            "provider": "openai",
            "model": "gpt-3.5-turbo",
            "messages": [
                {
                    "role": "system",
                    "content": "You are a professional and polite hotel reservation assistant. Your job is to help guests book rooms. You MUST ask for and confirm the check-in date, check-out date, preferred room type, and number of guests. Be concise and helpful."
                }
            ]
        },
        "extractionPlan": {
            "schema": {
                "type": "object",
                "properties": {
                    "checkInDate": { "type": "string", "description": "The date the guest wants to check in." },
                    "checkOutDate": { "type": "string", "description": "The date the guest wants to check out." },
                    "roomType": { "type": "string", "description": "The type of room requested (e.g. King, Deluxe, Suite)." },
                    "guests": { "type": "number", "description": "The total number of people staying." }
                }
            }
        },
        "voice": {
            "provider": "11labs",
            "voiceId": "paula"
        }
    },
    "housekeeping": {
        "name": "Hotel Housekeeping Agent",
        "firstMessage": "Hi there! This is housekeeping. How can I make your stay more comfortable today?",
        "model": {
            "provider": "openai",
            "model": "gpt-3.5-turbo",
            "messages": [
                {
                    "role": "system",
                    "content": "You are a hotel housekeeping assistant. Take requests for extra towels, room cleaning, toiletries, or maintenance issues. Assure the guest that their request will be handled promptly."
                }
            ]
        },
        "voice": {
            "provider": "11labs",
            "voiceId": "rachel"
        }
    },
    "feedback": {
        "name": "Hotel Feedback Call Agent",
        "firstMessage": "Hello! I hope you had a wonderful stay with us. Do you have a couple of minutes to share some feedback?",
        "model": {
            "provider": "openai",
            "model": "gpt-3.5-turbo",
            "messages": [
                {
                    "role": "system",
                    "content": "You are a customer success agent for a hotel. You are making an outbound call to a guest who recently checked out. Ask them about their stay, what they liked, and if there is anything we can improve."
                }
            ]
        },
        "voice": {
            "provider": "11labs",
            "voiceId": "drew"
        }
    }
}

@app.route("/api/stats", methods=["GET"])
def get_stats():
    return jsonify(MOCK_STATS)

@app.route("/api/assistants/create", methods=["POST"])
def create_assistant():
    data = request.json
    agent_type = data.get("type")
    
    if agent_type not in ASSISTANT_TEMPLATES:
        return jsonify({"error": "Invalid assistant type"}), 400
        
    payload = ASSISTANT_TEMPLATES[agent_type]
    
    response = requests.post(f"{VAPI_BASE_URL}/assistant", headers=HEADERS, json=payload)
    
    if response.status_code == 201 or response.status_code == 200:
        return jsonify({"success": True, "assistant": response.json()})
    else:
        return jsonify({"success": False, "error": response.text}), response.status_code

@app.route("/api/assistants", methods=["GET"])
def get_assistants():
    """
    Fetch all assistants from Vapi.
    """
    response = requests.get(f"{VAPI_BASE_URL}/assistant", headers=HEADERS)
    if response.status_code == 200:
        return jsonify({"success": True, "assistants": response.json()})
    else:
        return jsonify({"success": False, "error": response.text}), response.status_code

@app.route("/api/assistants/<assistant_id>", methods=["PATCH"])
def update_assistant(assistant_id):
    """
    Update an existing assistant's configuration in Vapi.
    """
    data = request.json
    response = requests.patch(f"{VAPI_BASE_URL}/assistant/{assistant_id}", headers=HEADERS, json=data)
    
    if response.status_code == 200:
        return jsonify({"success": True, "assistant": response.json()})
    else:
        return jsonify({"success": False, "error": response.text}), response.status_code

@app.route("/api/assistants/<assistant_id>", methods=["DELETE"])
def delete_assistant(assistant_id):
    """
    Delete an assistant from Vapi.
    """
    response = requests.delete(f"{VAPI_BASE_URL}/assistant/{assistant_id}", headers=HEADERS)
    if response.status_code in [200, 201]:
        return jsonify({"success": True, "message": "Deleted successfully"})
    else:
        return jsonify({"success": False, "error": response.text}), response.status_code

@app.route("/api/assistants/custom", methods=["POST"])
def create_custom_assistant():
    """
    Create a custom assistant.
    """
    data = request.json
    
    payload = {
        "name": data.get("name", "Custom Agent"),
        "firstMessage": data.get("firstMessage", "Hello!"),
        "firstMessageMode": data.get("firstMessageMode", "assistant-speaks-first"),
        "model": {
            "provider": "openai",
            "model": "gpt-3.5-turbo",
            "temperature": float(data.get("temperature", 0.7)),
            "maxTokens": int(data.get("maxTokens", 250)),
            "messages": [
                {
                    "role": "system",
                    "content": data.get("systemPrompt", "You are a helpful assistant.")
                }
            ]
        },
        "voice": {
            "provider": "11labs",
            "voiceId": "paula"
        }
    }
    
    response = requests.post(f"{VAPI_BASE_URL}/assistant", headers=HEADERS, json=payload)
    
    if response.status_code in [200, 201]:
        return jsonify({"success": True, "assistant": response.json()})
    else:
        return jsonify({"success": False, "error": response.text}), response.status_code

@app.route("/api/phone-number/create", methods=["POST"])
def create_phone_number():
    """
    Registers a Twilio phone number with Vapi.
    """
    data = request.json
    
    payload = {
        "provider": "twilio",
        "number": os.getenv("TWILIO_PHONE_NUMBER"),
        "twilioAccountSid": os.getenv("TWILIO_ACCOUNT_SID"),
        "twilioAuthToken": os.getenv("TWILIO_AUTH_TOKEN"),
        "name": data.get("name", "Phone Number 1")
    }
    
    response = requests.post(f"{VAPI_BASE_URL}/phone-number", headers=HEADERS, json=payload)
    
    if response.status_code in [200, 201]:
        return jsonify({"success": True, "phone_number": response.json()})
    else:
        return jsonify({"success": False, "error": response.text}), response.status_code

@app.route("/api/phone-numbers", methods=["GET"])
def get_phone_numbers():
    """
    Fetch all phone numbers from Vapi.
    """
    response = requests.get(f"{VAPI_BASE_URL}/phone-number", headers=HEADERS)
    if response.status_code == 200:
        return jsonify({"success": True, "phone_numbers": response.json()})
    else:
        return jsonify({"success": False, "error": response.text}), response.status_code

@app.route("/api/phone-numbers/<phone_id>", methods=["PATCH"])
def update_phone_number(phone_id):
    """
    Update a phone number's configuration (e.g., assigning an assistant).
    """
    data = request.json
    response = requests.patch(f"{VAPI_BASE_URL}/phone-number/{phone_id}", headers=HEADERS, json=data)
    if response.status_code == 200:
        return jsonify({"success": True, "phone_number": response.json()})
    else:
        return jsonify({"success": False, "error": response.text}), response.status_code

@app.route("/api/phone-numbers/<phone_id>", methods=["DELETE"])
def delete_phone_number(phone_id):
    """
    Delete a phone number from Vapi.
    """
    response = requests.delete(f"{VAPI_BASE_URL}/phone-number/{phone_id}", headers=HEADERS)
    if response.status_code in [200, 201]:
        return jsonify({"success": True, "message": "Deleted successfully"})
    else:
        return jsonify({"success": False, "error": response.text}), response.status_code

@app.route("/api/calls/outbound", methods=["POST"])
def make_outbound_call():
    """
    Makes a real outbound call using Vapi.
    """
    data = request.json
    
    payload = {
        "name": "Outbound call",
        "assistantId": data.get("assistantId"),
        "phoneNumberId": data.get("phoneNumberId"),
        "customer": {
            "numberE164CheckEnabled": True,
            "number": data.get("customerPhoneNumber"),
            "name": "Customer 1"
        }
    }
    
    response = requests.post(f"{VAPI_BASE_URL}/call", headers=HEADERS, json=payload)
    
    if response.status_code in [200, 201]:
        return jsonify({"success": True, "call": response.json()})
    else:
        return jsonify({"success": False, "error": response.text}), response.status_code

@app.route("/api/calls", methods=["GET"])
def get_calls():
    """
    Fetch call history from Vapi.
    """
    response = requests.get(f"{VAPI_BASE_URL}/call", headers=HEADERS)
    if response.status_code == 200:
        return jsonify({"success": True, "calls": response.json()})
    else:
        return jsonify({"success": False, "error": response.text}), response.status_code

@app.route("/api/reservations", methods=["GET"])
def get_reservations():
    """
    Returns the list of captured reservations.
    """
    return jsonify({"success": True, "reservations": RESERVATIONS})

@app.route("/api/webhook/vapi", methods=["POST"])
def handle_vapi_webhook():
    """
    Vapi Webhook handler to capture call outcomes and "do" reservations.
    """
    payload = request.get_json()
    message = payload.get('message', {})
    message_type = message.get('type')
    
    print(f"--- Vapi Webhook Received: {message_type} ---")
    
    # When a call ends, Vapi sends an end-of-call-report
    if message_type == 'end-of-call-report':
        call = message.get('call', {})
        assistant = message.get('assistant', {})
        assistant_name = assistant.get('name', '').lower()
        
        summary = message.get('summary', 'No summary provided.')
        transcript = message.get('transcript', '')
        customer = call.get('customer', {})
        
        # Use Gemini for enhanced extraction if transcript exists
        extracted = None
        if transcript:
            print("--- Sending transcript to Gemini for extraction ---")
            extracted = extract_reservation_with_gemini(transcript)
        
        # Fallback to Vapi structured data or defaults
        analysis = message.get('analysis', {})
        vapi_structured = analysis.get('structuredData', {})
        
        # Combine data
        res_data = extracted if extracted else {}
        
        # Calculate duration robustly
        duration = call.get('duration', 0)
        started_at = call.get('startedAt')
        ended_at = call.get('endedAt')
        
        if not duration and started_at and ended_at:
            try:
                from datetime import datetime
                start = datetime.fromisoformat(started_at.replace('Z', '+00:00'))
                end = datetime.fromisoformat(ended_at.replace('Z', '+00:00'))
                duration = (end - start).total_seconds()
            except Exception as e:
                print(f"Duration calculation error: {e}")

        reservation = {
            "id": call.get('id'),
            "assistant_name": assistant.get('name', 'Assistant'),
            "guest_name": res_data.get('guestName') or customer.get('name') or 'Unknown Guest',
            "phone": customer.get('number', 'Unknown Number'),
            "summary": summary,
            "dates": f"{res_data.get('checkInDate', vapi_structured.get('checkInDate', 'TBD'))} - {res_data.get('checkOutDate', vapi_structured.get('checkOutDate', 'TBD'))}",
            "room": res_data.get('roomType', vapi_structured.get('roomType', 'Any')),
            "guests": res_data.get('guests', vapi_structured.get('guests', '1')),
            "extras": res_data.get('extras', 'None'),
            "transcript": transcript,
            "status": "Completed",
            "timestamp": call.get('endedAt', ''),
            "duration": f"{duration:.1f}s"
        }
        
        RESERVATIONS.insert(0, reservation)
        MOCK_STATS["reservations_today"] += 1
        print(f"New Activity Captured from {reservation['assistant_name']}: {reservation['guest_name']}")

    elif message_type == 'status-update':
        call = message.get('call', {})
        status = call.get('status')
        print(f"Call {call.get('id')} Status: {status}")
        if status == 'in-progress':
            MOCK_STATS["active_calls"] += 1
        elif status == 'ended':
            MOCK_STATS["active_calls"] = max(0, MOCK_STATS["active_calls"] - 1)

    elif message_type == 'function-call':
        # Handle specific functions if defined in Vapi dashboard
        print(f"Function Call Received: {message.get('functionCall', {}).get('name')}")
        # You can expand this to check room availability in a real system!

    return jsonify({"received": True}), 200

if __name__ == "__main__":
    app.run(port=5001, debug=True)
