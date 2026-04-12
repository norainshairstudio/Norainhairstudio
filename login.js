document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const message = document.getElementById('message');

    try {
        // Backend (server.js) ko login ki request bhejna
        const response = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        // Agar response HTML de de galti se, to wo JSON parse mein fail hoga
        const result = await response.json();

        if (result.success) {
            // Frontend ko batayen ke login kamyaab ho gaya hai
            localStorage.setItem("isLoggedIn", "true");
            
            // Dashboard par bhej dein
            window.location.href = '/dashboard';
        } else {
            // Galat password ka message
            message.textContent = result.message || "Invalid credentials.";
            message.style.color = "red";
        }
    } catch (error) {
        console.error("Login Error:", error);
        message.textContent = "Server error: URL conflict ya backend nahi chal raha.";
        message.style.color = "red";
    }
});