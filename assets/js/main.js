
let chatHistory = JSON.parse(localStorage.getItem('chatHistory')) || [];
let themeLink = document.getElementById('theme-link');
let recognition;

if ('webkitSpeechRecognition' in window) {
    recognition = new webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => console.log('Speech Recognition: START');
    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        console.log('Recognized:', transcript);
        if (transcript) {
            addMessage(transcript, "user");
            fetchGeminiResponse(transcript);
        }
    };
    recognition.onerror = (event) => console.error('Speech Recognition Error:', event.error);
    recognition.onend = () => console.log('Speech Recognition: END');

    document.getElementById('start-btn').addEventListener('click', () => recognition.start());
} else {
    alert('Your browser does not support the Web Speech API');
}

function handleGoogleLoginResponse(response) {
    const credential = JSON.parse(atob(response.credential.split('.')[1]));
    const userName = credential.name;
    const userPicture = credential.picture; // Fetch the user's Google profile picture
    localStorage.setItem('displayName', userName);
    localStorage.setItem('profilePicture', userPicture); // Save profile picture to localStorage
    window.location.reload();
}

function getOperatorProfilePicture() {
    return localStorage.getItem('profilePicture') || './assets/img/user-profile.png';
}

// Check if the user is logged in
function checkLoginStatus() {
    const displayName = localStorage.getItem('displayName');
    if (displayName) {
        // Remove Google Sign-In elements if the user is logged in
        const googleOnloadElement = document.getElementById('g_id_onload');
        if (googleOnloadElement) {
            googleOnloadElement.remove();
        }
    }
}

// Run the login status check on page load
document.addEventListener('DOMContentLoaded', checkLoginStatus);

// Load chat history from localStorage
if (chatHistory.length > 0) {
    chatHistory.forEach((message) => {
        addMessage(message.text, message.role);
    });

    const ChatBox = document.getElementById("chat-box");
    ChatBox.scrollTop = ChatBox.scrollHeight;
}

document.getElementById("chat-form").addEventListener("submit", function (event) {
    event.preventDefault();
    const userInput = document.getElementById("user-input").value;
    addMessage(userInput, "user");
    fetchGeminiResponse(userInput);
    document.getElementById("user-input").value = "";
});

document.getElementById("user-input").addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
        if (event.shiftKey) {
            const cursorPosition = this.selectionStart;
            const value = this.value;
            this.value = value.slice(0, cursorPosition) + "\n" + value.slice(cursorPosition);
            this.selectionEnd = cursorPosition + 1;
            event.preventDefault();
        } else {
            event.preventDefault();
            document.getElementById("chat-form").dispatchEvent(new Event("submit"));
        }
    }
});

function setTheme(theme) {
    themeLink.href = `./assets/css/${theme}-theme.css`;
    localStorage.setItem('theme', theme);
}

setTheme(currentTheme);

function addMessage(message, sender) {
    const messages = document.getElementById("messages");

    const profile = document.createElement('div');
    profile.classList.add('profile', `${sender}-profile`);

    const messageElement = document.createElement("div");
    messageElement.classList.add("message", `${sender}-message`);

    if (sender === "assistant") {
        const formattedMessage = marked.parse(message);
        messageElement.innerHTML = formattedMessage;
    } else {
        const userText = message.replace(/\n/g, '<br>');
        messageElement.innerHTML = marked.parse(userText);
    }

    if (sender === "user") {
        profile.innerHTML = `<img src="${getOperatorProfilePicture()}" alt="User Profile Picture" class="profile-picture"><p class="name">${getOperatorName()}</p>`;
        messages.appendChild(profile);
        messages.appendChild(messageElement);
    } else if (sender === "assistant") {
        profile.innerHTML = `<img src="./assets/img/ai-profile.png" alt="AI Profile Picture" class="profile-picture"><p class="name">CodexAI</p>`;
        messages.appendChild(profile);
        messages.appendChild(messageElement);
    }

    chatHistory.push({ role: sender === "user" ? "user" : "assistant", text: message });
    localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
}

async function fetchGeminiResponse(message) {
    console.log(`Sending message to API: ${message}`);

    const base64ApiKeys = [
        "QUl6YVN5Q2dhZkNLcFFUTVBjeWxKSUdjLXNBd0l4XzVJVkxuZDNz", // API Key 1
        "QUl6YVN5QlZWQld1Y3htSkkwUWR4dVdnR0RqbklpMDFKaXFNOEgw", // API Key 2
    ];

    let currentKeyIndex = 0;

    const data = {
        contents: chatHistory.map(msg => ({ role: msg.role, parts: [{ text: msg.text }] })),
        systemInstruction: {
            role: "assistant",
            parts: [
                {
                    text: `You are CodexAI, an AI assistant based on Google Gemini. You are designed to provide helpful and informative responses. Be clear, concise, and avoid unnecessary details. When asked about code, provide well-formatted and explained examples. The user's name is ${getOperatorName()}.`,
                }
            ]
        },
        generationConfig: {
            temperature: 1,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 8192,
            responseMimeType: "text/plain"
        },
        tools: [
            {
                google_search: {}
            }
        ]
    };

    const headers = new Headers();
    headers.append("Content-Type", "application/json");

    while (currentKeyIndex < base64ApiKeys.length) {
        const apiKey = atob(base64ApiKeys[currentKeyIndex]);

        try {
            const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + apiKey, {
                method: "POST",
                headers: headers,
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const errorResponse = await response.json();
                console.error('API Request Failed:', errorResponse);
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log(result);

            if (result.candidates && result.candidates[0] && result.candidates[0].content && result.candidates[0].content.parts && result.candidates[0].content.parts[0]) {
                const botMessage = result.candidates[0].content.parts[0].text.trim();
                addMessage(botMessage, "assistant");
            } else {
                addMessage("I'm sorry, I am currently unable to process your request.", "assistant");
            }

            break;
        } catch (error) {
            console.error(`Error with API Key ${currentKeyIndex + 1}:`, error);

            currentKeyIndex++;

            if (currentKeyIndex === base64ApiKeys.length) {
                addMessage("I'm sorry, I am currently unable to process your request due to repeated API failures.", "assistant");
            }
        }
    }
}

function getOperatorName() {
    return localStorage.getItem('displayName') || 'User';
}

document.getElementById('theme-toggle-btn').addEventListener('click', () => {
    const newTheme = themeLink.href.includes('dark-theme.css') ? 'light' : 'dark';
    setTheme(newTheme);
});

document.getElementById('clear-btn').addEventListener('click', () => {
    localStorage.removeItem('chatHistory');
    window.location.reload();
});